// Passo 7: ligação em tempo real a uma sala de leilão
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';

export function useLeilao(id, token) {
  const socketRef = useRef(null);
  const [leilao, setLeilao] = useState(null);
  const [atual, setAtual] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('entrar', id);
    socket.on('estado', (l) => { setLeilao(l); setAtual(l.licitacaoAtual); });
    socket.on('nova-licitacao', setAtual);
    socket.on('presenca', setParticipantes);
    socket.on('recusada', setErro);
    socket.on('connect_error', (e) => setErro(e.message));
    // TODO: evento de fim de leilão ('terminado') e histórico de licitações

    return () => {
      socket.emit('sair', id);
      socket.disconnect();
    };
  }, [id, token]);

  const licitar = (valor) => {
    setErro('');
    socketRef.current?.emit('licitar', { leilaoId: id, valor });
  };

  return { leilao, atual, participantes, erro, licitar };
}
