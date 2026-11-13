// Administrador: estado dos serviços Cloud (a API verifica cada um com limite de tempo)
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ROTULO = { ok: 'Operacional', aviso: 'Atenção', erro: 'Falha' };

export default function ServicosCloud({ token, aoExpirar }) {
  const [dados, setDados] = useState(null);
  const [aVerificar, setAVerificar] = useState(false);
  const [erro, setErro] = useState('');

  async function verificar() {
    setAVerificar(true);
    try {
      setDados(await api('/admin/servicos', { token }));
      setErro('');
    } catch (err) {
      if (err.status === 401) return aoExpirar();
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setAVerificar(false);
    }
  }

  useEffect(() => {
    verificar();
    const t = setInterval(verificar, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section aria-labelledby="titulo-servicos" className="mb-4">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h2 id="titulo-servicos" className="h4 mb-0">Estado dos serviços Cloud</h2>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={verificar} disabled={aVerificar}>
          {aVerificar ? 'A verificar...' : 'Verificar agora'}
        </button>
      </div>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {!dados && !erro && <p className="text-muted">A verificar...</p>}

      {dados && (
        <>
          <div className="grelha-servicos">
            {dados.servicos.map((s) => (
              <div key={s.id}>
                <div className={`card h-100 servico servico--${s.estado}`}>
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="servico__ponto" aria-hidden="true" />
                      <strong>{s.nome}</strong>
                    </div>
                    <div className="servico__estado">{ROTULO[s.estado]}</div>
                    <div className="small text-muted">{s.detalhe}</div>
                    {s.latenciaMs !== undefined && <div className="small text-muted">{s.latenciaMs} ms</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="small text-muted mt-2 mb-0">
            Verificado às {new Date(dados.verificadoEm).toLocaleTimeString('pt-PT')} · atualiza a cada 30 s
          </p>
        </>
      )}
    </section>
  );
}
