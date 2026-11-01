// Comprador: sala de leilão em tempo real
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import PorImplementar from '../components/PorImplementar.jsx';

export default function SalaLeilao() {
  const { id } = useParams();
  const { token } = useAuth();
  const { leilao, atual, participantes, erro, licitar } = useLeilao(id, token);
  const [valor, setValor] = useState('');

  return (
    <div className="sala-leilao">
      <section>
        <h1>{leilao?.lote || 'Leilão'}</h1>
        <PorImplementar passo={7}>detalhes do lote, fotografia e histórico de licitações.</PorImplementar>
      </section>

      <aside className="card p-3">
        <p className="mb-1">{participantes} a assistir</p>
        {/* TODO (Passo 7): contagem decrescente calculada a partir de leilao.terminaEm */}
        <p className="texto-secundario small mb-0">Licitação atual</p>
        <p className="valor-atual">{atual?.valor != null ? `${atual.valor.toFixed(2)} €` : '—'}</p>

        <form onSubmit={(e) => { e.preventDefault(); licitar(Number(valor)); }}>
          <label htmlFor="valor" className="form-label">O seu valor (€)</label>
          <input id="valor" type="number" step="0.01" min="0" className="form-control mb-2"
            value={valor} onChange={(e) => setValor(e.target.value)} required />
          <button type="submit" className="btn btn-success w-100">Licitar</button>
        </form>
        {erro && <div className="alert alert-warning mt-2 mb-0">{erro}</div>}
      </aside>
    </div>
  );
}
