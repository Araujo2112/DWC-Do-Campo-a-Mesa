import { useState } from 'react';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';
import IconeMartelo from './IconeMartelo.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const arredondar = (v) => Math.round(v * 100) / 100;
const duasCasas = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const ATALHOS = [5, 10, 25];

function IconeRelogio() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconeUtilizadores() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

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

  const duracao = new Date(leilao.terminaEm) - new Date(leilao.iniciaEm);
  const decorrido = terminado ? 100
    : agendado || duracao <= 0 ? 0
    : Math.min(100, Math.max(0, 100 - (restante / duracao) * 100));
  const lider = licitacoes.find((l) => l.comprador === leilao.licitacaoAtual.comprador);

  const mensagem = erro
    || (podeLicitar && aberto ? (souLider ? 'A tua licitação é a mais alta.' : `Licitação mínima: ${euro(minimo)}`) : '');

  function submeter(e) {
    e.preventDefault();
    if (!valido) return;
    onLicitar(valorNum);
    setValor('');
  }

  return (
    <aside className="painel-leilao">
      <div className="painel-leilao__cartao">
        {!ligado && <div className="alert alert-warning py-2" role="status">A ligar ao servidor...</div>}

        <div className="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div className="painel-leilao__rotulo">
              {agendado ? 'Começa em' : terminado ? 'Leilão terminado' : 'Termina em'}
            </div>
            {!terminado && (
              <div className="painel-leilao__tempo">
                <IconeRelogio />
                {leilao.estado === 'ativo' && restante === 0 ? 'A terminar...' : formatarTempo(restante)}
              </div>
            )}
          </div>
          <span className="painel-leilao__rotulo d-inline-flex align-items-center gap-1">
            <IconeUtilizadores /> {participantes} a assistir
          </span>
        </div>

        <div className="painel-leilao__barra" role="progressbar" aria-label="Tempo decorrido"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(decorrido)}>
          <span style={{ width: `${decorrido}%` }} />
        </div>

        <div className="painel-leilao__rotulo">Licitação atual</div>
        <div className="painel-leilao__valor">{euro(atual)}</div>
        {lider && <div className="painel-leilao__rotulo">por {lider.nome}{souLider && ' (tu)'}</div>}

        {terminado && (
          <div className="alert alert-success mt-3 mb-0">
            {fim?.vencedor
              ? (fim.vencedor.id === utilizador?.id
                ? `Ganhaste este leilão por ${euro(fim.valor)}! A encomenda foi criada.`
                : `Vencedor: ${fim.vencedor.nome}, por ${euro(fim.valor)}.`)
              : 'O leilão terminou sem licitações.'}
          </div>
        )}

        {podeLicitar && aberto && (
          <form onSubmit={submeter} className="mt-3">
            <div className="d-flex gap-2 mb-2">
              {ATALHOS.map((n) => (
                <button key={n} type="button" className="btn btn-outline-secondary flex-fill"
                  onClick={() => setValor(Math.max(minimo, arredondar(atual + n)).toFixed(2))}>
                  +{euro(n)}
                </button>
              ))}
            </div>
            <label htmlFor="valor" className="form-label small">O teu valor (mínimo {euro(minimo)})</label>
            <input id="valor" type="number" step="0.01" min={minimo} className="form-control mb-2"
              value={valor === '' ? minimo.toFixed(2) : valor} onChange={(e) => setValor(e.target.value)} required />
            <button type="submit" disabled={!valido || souLider || !ligado}
              className="btn btn-success w-100 d-inline-flex align-items-center justify-content-center gap-2">
              <IconeMartelo tamanho={18} />
              {valido ? `Licitar ${euro(valorNum)}` : 'Licitar'}
            </button>
          </form>
        )}

        {mensagem && (
          <div className="painel-leilao__aviso" role={erro ? 'alert' : 'status'}>{mensagem}</div>
        )}
      </div>

      <div className="painel-leilao__cartao">
        <h2 className="h6">Licitações</h2>
        {licitacoes.length === 0 && <p className="text-muted small mb-0">Ainda sem licitações.</p>}
        <ol className="painel-leilao__lista">
          {licitacoes.map((l, i) => (
            <li key={l.id ?? l.valor}
              className={`painel-leilao__licitacao${i === 0 ? ' painel-leilao__licitacao--lider' : ''}`}>
              <span>{l.nome}{utilizador && l.comprador === utilizador.id && ' (tu)'}</span>
              <span className="texto-secundario">{new Date(l.criadoEm).toLocaleTimeString('pt-PT')}</span>
              <strong>{euro(l.valor)}</strong>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
