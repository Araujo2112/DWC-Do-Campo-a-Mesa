// Painel de licitação: contagem decrescente, valor mínimo, atalhos e histórico
import { useState } from 'react';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const arredondar = (v) => Math.round(v * 100) / 100;
const duasCasas = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const ATALHOS = [5, 10, 25];

export default function PainelLeilao({
  leilao, licitacoes, participantes, fim, offset, utilizador, podeLicitar, ligado, erro, onLicitar,
}) {
  const [valor, setValor] = useState('');
  const agendado = leilao.estado === 'agendado';
  const terminado = leilao.estado === 'terminado';
  const restante = useContagem(agendado ? leilao.iniciaEm : leilao.terminaEm, offset);

  const atual = leilao.licitacaoAtual.valor;
  const minimo = arredondar(atual + leilao.incremento);
  const valorNum = valor === '' ? minimo : Number(valor);
  const valido = Number.isFinite(valorNum) && valorNum >= minimo && duasCasas(valorNum);
  const souLider = Boolean(utilizador) && leilao.licitacaoAtual.comprador === utilizador.id;
  const aberto = leilao.estado === 'ativo' && restante > 0;

  function submeter(e) {
    e.preventDefault();
    if (!valido) return;
    onLicitar(valorNum);
    setValor('');
  }

  return (
    <aside className="card p-3">
      {!ligado && <div className="alert alert-warning py-2">A ligar ao servidor...</div>}

      <div className="d-flex justify-content-between align-items-center">
        <div>
          <div className="small text-muted">
            {agendado ? 'Começa em' : terminado ? 'Leilão terminado' : 'Termina em'}
          </div>
          {!terminado && (
            <div className="fs-2 fw-bold">
              {leilao.estado === 'ativo' && restante === 0 ? 'A terminar...' : formatarTempo(restante)}
            </div>
          )}
        </div>
        <span className="text-muted small">{participantes} a assistir</span>
      </div>

      <hr />

      <p className="texto-secundario small mb-0">Licitação atual</p>
      <p className="valor-atual mb-1">{euro(atual)}</p>
      {souLider && !terminado && <p className="text-success small">É a licitação mais alta (a tua).</p>}

      {terminado && (
        <div className="alert alert-success">
          {fim?.vencedor
            ? (fim.vencedor.id === utilizador?.id
              ? `Ganhaste este leilão por ${euro(fim.valor)}! A encomenda foi criada.`
              : `Vencedor: ${fim.vencedor.nome}, por ${euro(fim.valor)}.`)
            : 'O leilão terminou sem licitações.'}
        </div>
      )}

      {podeLicitar && aberto && (
        <form onSubmit={submeter}>
          <div className="d-flex gap-2 mb-2">
            {ATALHOS.map((n) => (
              <button key={n} type="button" className="btn btn-outline-secondary flex-fill"
                onClick={() => setValor(Math.max(minimo, arredondar(atual + n)).toFixed(2))}>
                +{n} €
              </button>
            ))}
          </div>
          <label htmlFor="valor" className="form-label">O teu valor (mínimo {euro(minimo)})</label>
          <input id="valor" type="number" step="0.01" min={minimo} className="form-control mb-2"
            value={valor === '' ? minimo.toFixed(2) : valor} onChange={(e) => setValor(e.target.value)} required />
          <button type="submit" className="btn btn-success w-100" disabled={!valido || souLider || !ligado}>
            {valido ? `Licitar ${euro(valorNum)}` : 'Licitar'}
          </button>
        </form>
      )}

      {erro && <div className="alert alert-warning mt-2 mb-0" role="alert">{erro}</div>}

      <h2 className="h6 mt-4">Licitações ({leilao.numLicitacoes})</h2>
      {licitacoes.length === 0 && <p className="text-muted small mb-0">Ainda sem licitações.</p>}
      <ol className="list-unstyled mb-0">
        {licitacoes.map((l) => (
          <li key={l.id ?? l.valor} className="d-flex justify-content-between small py-1 border-top">
            <span>
              {l.nome}{utilizador && l.comprador === utilizador.id && ' (tu)'}
              <span className="text-muted"> · {new Date(l.criadoEm).toLocaleTimeString('pt-PT')}</span>
            </span>
            <strong>{euro(l.valor)}</strong>
          </li>
        ))}
      </ol>
    </aside>
  );
}
