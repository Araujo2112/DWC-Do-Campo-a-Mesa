// Sala de leilão em tempo real (comprador licita; produtor acompanha)
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import PainelLeilao from '../components/PainelLeilao.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const ROTULO = { agendado: 'Agendado', ativo: 'Em direto', terminado: 'Terminado' };

export default function SalaLeilao() {
  const { id } = useParams();
  const { utilizador, token } = useAuth();
  const { leilao, licitacoes, participantes, fim, offset, ligado, erro, licitar } = useLeilao(id, token);

  if (!leilao) {
    return erro
      ? <div className="alert alert-warning" role="alert">{erro}</div>
      : <p>A carregar...</p>;
  }

  return (
    <div className="sala-leilao">
      <section>
        <p className="mb-1">
          <span className={`badge ${leilao.estado === 'ativo' ? 'text-bg-danger' : 'text-bg-secondary'}`}>
            {ROTULO[leilao.estado]}
          </span>
        </p>
        <h1>{leilao.lote}</h1>
        <p className="texto-secundario">
          <Link to={`/produtores/${leilao.produtor.id}`} className="text-reset">{leilao.produtor.nome}</Link>
          {leilao.produtor.localidade && <> · {leilao.produtor.localidade}</>}
        </p>

        <div className="row row-cols-2 row-cols-md-3 g-3">
          {leilao.quantidade && (
            <div className="col"><div className="card card-body">
              <div className="small text-muted">Quantidade</div><strong>{leilao.quantidade}</strong>
            </div></div>
          )}
          <div className="col"><div className="card card-body">
            <div className="small text-muted">Preço base</div><strong>{euro(leilao.precoBase)}</strong>
          </div></div>
          <div className="col"><div className="card card-body">
            <div className="small text-muted">Incremento mínimo</div><strong>{euro(leilao.incremento)}</strong>
          </div></div>
        </div>
      </section>

      <PainelLeilao
        leilao={leilao}
        licitacoes={licitacoes}
        participantes={participantes}
        fim={fim}
        offset={offset}
        utilizador={utilizador}
        podeLicitar={utilizador?.papel === 'comprador'}
        ligado={ligado}
        erro={erro}
        onLicitar={licitar}
      />
    </div>
  );
}
