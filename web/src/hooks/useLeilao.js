// Passo 7: ligação em tempo real a uma sala de leilão
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';

export function useLeilao(id, token) {
  const socketRef = useRef(null);
  const [leilao, setLeilao] = useState(null);
  const [licitacoes, setLicitacoes] = useState([]);
  const [participantes, setParticipantes] = useState(0);
  const [fim, setFim] = useState(null);       // { vencedor, valor } quando o leilão terminou
  const [offset, setOffset] = useState(0);    // relógio do servidor - relógio do cliente
  const [ligado, setLigado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    setLeilao(null);
    setLicitacoes([]);
    setFim(null);

    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    // Emite "entrar" a cada ligação: depois de uma quebra de rede, volta à sala sozinho.
    socket.on('connect', () => { setLigado(true); setErro(''); socket.emit('entrar', id); });
    socket.on('disconnect', () => setLigado(false));
    socket.on('connect_error', (e) => setErro(
      e.message === 'não autorizado' ? 'Sessão inválida. Entra de novo.' : 'Não foi possível ligar ao servidor'));

    socket.on('estado', (e) => {
      if (e.leilao.id !== id) return;
      setLeilao(e.leilao);
      setLicitacoes(e.licitacoes);
      setOffset(e.agora - Date.now());
      if (e.leilao.estado === 'terminado') {
        const topo = e.licitacoes[0];
        setFim(e.leilao.licitacaoAtual.comprador && topo
          ? { vencedor: { id: topo.comprador, nome: topo.nome }, valor: e.leilao.licitacaoAtual.valor }
          : { vencedor: null, valor: null });
      } else {
        setFim(null);
      }
    });

    socket.on('nova-licitacao', (n) => {
      if (n.leilaoId !== id) return;
      // Se duas licitações chegarem fora de ordem, a mais baixa é ignorada: todos convergem para o mesmo valor.
      setLeilao((l) => {
        if (!l || n.valor <= l.licitacaoAtual.valor) return l;
        return { ...l, licitacaoAtual: { valor: n.valor, comprador: n.comprador }, numLicitacoes: n.numLicitacoes };
      });
      setLicitacoes((ls) => {
        if (ls.some((x) => x.valor === n.valor)) return ls;
        return [n, ...ls].sort((a, b) => b.valor - a.valor).slice(0, 10);
      });
      setErro('');
    });

    socket.on('presenca', setParticipantes);
    socket.on('recusada', setErro);
    socket.on('terminado', (t) => {
      if (t.leilaoId !== id) return;
      setLeilao((l) => (l ? { ...l, estado: 'terminado' } : l));
      setFim({ vencedor: t.vencedor, valor: t.valor });
    });

    return () => {
      socket.emit('sair', id);
      socket.disconnect(); // sai da sala ao mudar de página
    };
  }, [id, token]);

  const licitar = (valor) => {
    setErro('');
    socketRef.current?.emit('licitar', { leilaoId: id, valor });
  };

  return { leilao, licitacoes, participantes, fim, offset, ligado, erro, licitar };
}
