// Comprador: acompanhamento das encomendas
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import PorImplementar from '../components/PorImplementar.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function Encomendas() {
  const { token, sair } = useAuth();
  const [encomendas, setEncomendas] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      setEncomendas(await api('/orders', { token }));
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

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Encomendas</h1>
        <button type="button" className="btn btn-outline-secondary" onClick={carregar}>Atualizar</button>
      </div>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}
      {!aCarregar && !erro && encomendas.length === 0 && <p>Ainda não fizeste nenhuma encomenda.</p>}

      {encomendas.map((o) => (
        <article key={o.id} className="card p-3 mb-3">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <p className="fw-bold mb-0">#{o.id.slice(-6).toUpperCase()} · {o.produtor.nome}</p>
            <span className="text-muted small">{new Date(o.criadoEm).toLocaleDateString('pt-PT')}</span>
          </div>

          <EstadoEncomenda estado={o.estado} />

          <ul className="list-unstyled mt-3 mb-2">
            {o.linhas.map((l) => (
              <li key={l.produto} className="d-flex justify-content-between">
                <span>{l.quantidade} × {l.nome}</span>
                <span>{euro(l.precoUnit * l.quantidade)}</span>
              </li>
            ))}
          </ul>

          <p className="fw-bold mb-1">Total: {euro(o.total)}</p>
          <p className="text-muted small mb-0">
            {o.entrega.tipo === 'entrega' ? `Entrega em: ${o.entrega.morada}` : 'Levantamento no produtor'}
          </p>
        </article>
      ))}

      <PorImplementar passo={7}>
        atualizar em tempo real com o evento <code>encomenda-atualizada</code> e permitir avaliar encomendas entregues.
      </PorImplementar>
    </>
  );
}