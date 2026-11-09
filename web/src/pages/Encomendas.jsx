// Comprador: acompanhamento das encomendas (atualizadas em tempo real)
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotificacoes } from '../hooks/useNotificacoes.js';
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import AvaliacoesDaEncomenda from '../components/AvaliacoesDaEncomenda.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const codigo = (id) => `#${String(id).slice(-6).toUpperCase()}`;

export default function Encomendas() {
  const { token, sair } = useAuth();
  const [encomendas, setEncomendas] = useState([]);
  const [minhas, setMinhas] = useState([]); // as avaliações que já fiz
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function carregar() {
    try {
      const [lista, avaliadas] = await Promise.all([
        api('/orders', { token }),
        api('/reviews/minhas', { token }),
      ]);
      setEncomendas(lista);
      setMinhas(avaliadas);
      setErro('');
    } catch (err) {
      if (err.status === 401) return sair();
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useNotificacoes(token, (evento, dados) => {
    if (evento === 'encomenda-atualizada') {
      const id = String(dados.id);
      const o = encomendas.find((x) => x.id === id);
      setEncomendas((lista) => lista.map((x) => (x.id === id ? { ...x, estado: dados.estado } : x)));
      setAviso(`${o ? o.produtor.nome : 'O produtor'} marcou a encomenda ${codigo(id)} como "${dados.estado}".`);
    }
    if (evento === 'leilao-ganho') {
      carregar(); // a encomenda do leilão acabou de ser criada
      setAviso(`Ganhaste o leilão "${dados.lote}" por ${euro(dados.valor)}. A encomenda já está na lista.`);
    }
  });

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Encomendas</h1>
        <button type="button" className="btn btn-outline-secondary" onClick={carregar}>Atualizar</button>
      </div>

      {aviso && (
        <div className="alert alert-success d-flex justify-content-between align-items-center" role="status">
          <span>{aviso}</span>
          <button type="button" className="btn-close" aria-label="Fechar aviso" onClick={() => setAviso('')} />
        </div>
      )}
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}
      {!aCarregar && !erro && encomendas.length === 0 && <p>Ainda não fizeste nenhuma encomenda.</p>}

      {encomendas.map((o) => (
        <article key={o.id} className="card p-3 mb-3">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <p className="fw-bold mb-0">{codigo(o.id)} · {o.produtor.nome}</p>
            <span className="text-muted small">{new Date(o.criadoEm).toLocaleDateString('pt-PT')}</span>
          </div>

          <EstadoEncomenda estado={o.estado} />

          <ul className="list-unstyled mt-3 mb-2">
            {o.linhas.map((l, i) => (
              <li key={`${o.id}-${i}`} className="d-flex justify-content-between">
                <span>{l.quantidade} × {l.nome}</span>
                <span>{euro(l.precoUnit * l.quantidade)}</span>
              </li>
            ))}
          </ul>

          <p className="fw-bold mb-1">Total: {euro(o.total)}</p>
          <p className="text-muted small mb-0">
            {o.entrega.tipo === 'entrega' ? `Entrega em: ${o.entrega.morada}` : 'Levantamento no produtor'}
          </p>

          {o.estado === 'entregue' && (
            <AvaliacoesDaEncomenda
              encomenda={o}
              minhas={minhas}
              token={token}
              aoAvaliar={(nova) => setMinhas((lista) => [nova, ...lista])}
            />
          )}
        </article>
      ))}
    </>
  );
}
