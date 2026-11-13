// Administrador: validação de produtores, moderação e estatísticas
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import { useContagem, formatarTempo } from '../../hooks/useContagem.js';

const CONTADORES = [
  ['utilizadores', 'Utilizadores'],
  ['produtores', 'Produtores ativos'],
  ['produtoresPorValidar', 'Por validar'],
  ['encomendasHoje', 'Encomendas hoje'],
  ['leiloesAtivos', 'Leilões ativos'],
];

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

function Restante({ alvo }) {
  const ms = useContagem(alvo);
  return <>{ms === 0 ? 'agora' : formatarTempo(ms)}</>;
}

export default function PainelAdmin() {
  const { token, sair } = useAuth();
  const [estatisticas, setEstatisticas] = useState(null);
  const [pendentes, setPendentes] = useState([]);
  const [denunciadas, setDenunciadas] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [aDecidir, setADecidir] = useState(null); // id do produtor com um pedido em curso
  const [aModerar, setAModerar] = useState(null); // id da avaliação com um pedido em curso
  const [erro, setErro] = useState('');

  function tratarErro(err) {
    // 401: o token expirou ou o utilizador já não existe
    if (err.status === 401) return sair();
    setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
  }

  async function carregar() {
    try {
      const [est, pend, den, leis] = await Promise.all([
        api('/admin/estatisticas', { token }),
        api('/admin/produtores/pendentes', { token }),
        api('/admin/reviews/denunciadas', { token }),
        api('/auctions?estado=ativo'),
      ]);
      setEstatisticas(est);
      setPendentes(pend);
      setDenunciadas(den);
      setAtivos(leis);
      setErro('');
    } catch (err) {
      tratarErro(err);
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function decidir(id, aprovado) {
    setADecidir(id);
    try {
      await api(`/admin/produtores/${id}/validacao`, { metodo: 'PATCH', corpo: { aprovado }, token });
      await carregar(); // volta a pedir: a lista e os contadores mudam
    } catch (err) {
      tratarErro(err);
    } finally {
      setADecidir(null);
    }
  }

  async function moderar(id, acao) {
    setAModerar(id);
    try {
      await api(`/admin/reviews/${id}`, { metodo: 'PATCH', corpo: { acao }, token });
      await carregar();
    } catch (err) {
      tratarErro(err);
    } finally {
      setAModerar(null);
    }
  }

  return (
    <>
      <h1>Administração</h1>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}

      {estatisticas && (
        <section aria-label="Estatísticas" className="mb-4">
          <div className="grelha-indicadores grelha-indicadores--admin">
            {CONTADORES.map(([campo, etiqueta]) => (
              <div key={campo}>
                <div className="card h-100">
                  <div className="card-body">
                    <div className="indicador__valor">{estatisticas[campo]}</div>
                    <div className="text-muted small">{etiqueta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="titulo-pendentes" className="mb-4">
        <h2 id="titulo-pendentes" className="h4">Produtores por validar</h2>
        {!aCarregar && pendentes.length === 0 && (
          <p className="text-muted">Não há produtores a aguardar validação.</p>
        )}
        <ul className="list-group">
          {pendentes.map((p) => (
            <li
              key={p.id}
              className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2"
            >
              <div>
                <strong>{p.produtor?.nomeExploracao}</strong>
                <div className="small text-muted">
                  {p.produtor?.localidade} · {p.email} · registado a {new Date(p.criadoEm).toLocaleDateString('pt-PT')}
                </div>
                {p.produtor?.descricao && <div className="small">{p.produtor.descricao}</div>}
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={aDecidir !== null}
                  onClick={() => decidir(p.id, false)}
                >
                  Rejeitar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={aDecidir !== null}
                  onClick={() => decidir(p.id, true)}
                >
                  Aprovar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-denunciadas" className="mb-4">
        <h2 id="titulo-denunciadas" className="h4">Avaliações denunciadas</h2>
        {!aCarregar && denunciadas.length === 0 && (
          <p className="text-muted">Não há avaliações por moderar.</p>
        )}
        <ul className="list-group">
          {denunciadas.map((r) => (
            <li
              key={r.id}
              className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2"
            >
              <div>
                <div>
                  <span aria-label={`${r.classificacao} em 5`}>{'★'.repeat(r.classificacao)}</span>
                  {' '}<strong>{r.autor}</strong> sobre {r.produto ? `${r.produto} (${r.produtor})` : r.produtor}
                </div>
                {r.comentario && <div>{r.comentario}</div>}
                <div className="small text-muted">
                  {r.numDenuncias} {r.numDenuncias === 1 ? 'denúncia' : 'denúncias'}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" disabled={aModerar !== null}
                  onClick={() => moderar(r.id, 'manter')}>
                  Manter
                </button>
                <button type="button" className="btn btn-outline-danger" disabled={aModerar !== null}
                  onClick={() => moderar(r.id, 'ocultar')}>
                  Ocultar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-leiloes" className="mb-4">
        <h2 id="titulo-leiloes" className="h4">Leilões ativos</h2>
        {!aCarregar && ativos.length === 0 && <p className="text-muted">Não há leilões em direto.</p>}
        <ul className="list-group">
          {ativos.map((l) => (
            <li key={l.id} className="list-group-item d-flex flex-column flex-md-row justify-content-between gap-1">
              <div>
                <strong>{l.lote}</strong>
                <div className="small text-muted">{l.produtor.nome} · {l.numLicitacoes} licitações</div>
              </div>
              <div className="text-md-end">
                <div className="fw-bold">{euro(l.licitacaoAtual.valor)}</div>
                <div className="small text-muted">Termina em <Restante alvo={l.terminaEm} /></div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}