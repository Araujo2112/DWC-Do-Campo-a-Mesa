// Administrador: validação de produtores, moderação e estatísticas
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import PorImplementar from '../../components/PorImplementar.jsx';

const CONTADORES = [
  ['utilizadores', 'Utilizadores'],
  ['produtores', 'Produtores ativos'],
  ['produtoresPorValidar', 'Por validar'],
  ['encomendasHoje', 'Encomendas hoje'],
  ['leiloesAtivos', 'Leilões ativos'],
];

export default function PainelAdmin() {
  const { token, sair } = useAuth();
  const [estatisticas, setEstatisticas] = useState(null);
  const [pendentes, setPendentes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [aDecidir, setADecidir] = useState(null); // id do produtor com um pedido em curso
  const [erro, setErro] = useState('');

  function tratarErro(err) {
    // 401: o token expirou ou o utilizador já não existe
    if (err.status === 401) return sair();
    setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
  }

  async function carregar() {
    try {
      const [est, pend] = await Promise.all([
        api('/admin/estatisticas', { token }),
        api('/admin/produtores/pendentes', { token }),
      ]);
      setEstatisticas(est);
      setPendentes(pend);
      setErro('');
    } catch (err) {
      tratarErro(err);
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    carregar();
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

  return (
    <>
      <h1>Administração</h1>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}

      {estatisticas && (
        <section aria-label="Estatísticas" className="mb-4">
          <div className="row row-cols-2 row-cols-md-3 row-cols-xl-5 g-3">
            {CONTADORES.map(([campo, etiqueta]) => (
              <div className="col" key={campo}>
                <div className="card h-100">
                  <div className="card-body">
                    <div className="fs-2 fw-bold">{estatisticas[campo]}</div>
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

      <PorImplementar passo={3}>
        avaliações denunciadas (<code>GET /api/admin/reviews/denunciadas</code>) e lista de leilões ativos.
      </PorImplementar>
    </>
  );
}