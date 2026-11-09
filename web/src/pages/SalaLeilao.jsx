import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import PainelLeilao from '../components/PainelLeilao.jsx';
import IconeMartelo from '../components/IconeMartelo.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const dataHora = (d) => new Date(d).toLocaleString('pt-PT', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
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

  const agendado = leilao.estado === 'agendado';
  const dados = [
    ['Preço base', euro(leilao.precoBase)],
    ['Incremento mínimo', euro(leilao.incremento)],
    ['Licitações', leilao.numLicitacoes],
    [agendado ? 'Começa' : 'Termina', dataHora(agendado ? leilao.iniciaEm : leilao.terminaEm)],
  ];

  return (
    <>
      <nav aria-label="Caminho" className="small mb-3">
        <Link to="/leiloes">Leilões</Link>
        <span className="texto-secundario"> / {leilao.lote}</span>
      </nav>

      <div className="sala-leilao">
        <section>
          <div className="sala-leilao__titulo">
            <h1>{leilao.lote}</h1>
            <span className={`selo-estado selo-estado--${leilao.estado}`}>{ROTULO[leilao.estado]}</span>
          </div>
          <p className="texto-secundario mb-0">
            <Link to={`/produtores/${leilao.produtor.id}`} className="text-reset">{leilao.produtor.nome}</Link>
            {leilao.produtor.localidade && <> · {leilao.produtor.localidade}</>}
          </p>

          <div className="sala-leilao__imagem" aria-hidden="true">
            <IconeMartelo tamanho={96} />
          </div>

          <div className="row row-cols-2 row-cols-md-4 g-3">
            {dados.map(([rotulo, valor]) => (
              <div className="col" key={rotulo}>
                <div className="sala-leilao__dado"><span>{rotulo}</span><strong>{valor}</strong></div>
              </div>
            ))}
          </div>

          {leilao.quantidade && <p className="mt-3 mb-0"><strong>Quantidade:</strong> {leilao.quantidade}</p>}
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
    </>
  );
}
