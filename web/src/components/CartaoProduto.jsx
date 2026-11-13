import { Link } from 'react-router-dom';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import Estrelas from './Estrelas.jsx';

// "Hortícolas" -> "horticolas": escolhe a cor do cartão
const slug = (t = '') => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function CartaoProduto({ produto, onAdicionar, onVerAvaliacoes }) {
  const { quantidadeDe, alterar, remover } = useCarrinho();

  const dono = produto.produtor && typeof produto.produtor === 'object' ? produto.produtor : null;
  const esgotado = produto.stock <= 0;
  const noCarrinho = onAdicionar ? quantidadeDe(produto._id) : 0;
  const noLimite = noCarrinho >= produto.stock;

  // Com 1 unidade, o "−" tira o produto do carrinho e volta o botão "Adicionar".
  const diminuir = () => (noCarrinho <= 1 ? remover(produto._id) : alterar(produto._id, noCarrinho - 1));

  return (
    <article className="card cartao-produto h-100">
      <div className={`cartao-produto__imagem cartao-produto__imagem--${slug(produto.categoria)}`}>
        {produto.imagemUrl ? (
          <img src={produto.imagemUrl} alt={produto.nome} />
        ) : (
          <span className="cartao-produto__letra" aria-hidden="true">{produto.nome.charAt(0)}</span>
        )}
        {produto.biologico && <span className="etiqueta-bio">BIO</span>}
      </div>
      <div className="card-body d-flex flex-column">
        <h3 className="h6 mb-1">{produto.nome}</h3>
        {dono && (
          <p className="texto-secundario small mb-3">
            <svg className="icone-local" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>{' '}
            <Link to={`/produtores/${dono._id}`} className="text-reset">{dono.nome}</Link>
            {dono.produtor?.localidade && <> · {dono.produtor.localidade}</>}
          </p>
        )}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mt-auto mb-3">
          <p className="preco mb-0">
            {euro(produto.preco)} <span className="texto-secundario small fw-normal">/ {produto.unidade}</span>
          </p>
          {produto.numAvaliacoes !== undefined && (
            <span className="texto-secundario small text-end">
              {onVerAvaliacoes && produto.numAvaliacoes > 0 ? (
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline"
                  aria-label={`Ver as avaliações de ${produto.nome}`} onClick={() => onVerAvaliacoes(produto)}>
                  <Estrelas media={produto.avaliacaoMedia} total={produto.numAvaliacoes} />
                </button>
              ) : (
                <Estrelas media={produto.avaliacaoMedia} total={produto.numAvaliacoes} />
              )}
            </span>
          )}
        </div>

        {onAdicionar && (noCarrinho === 0 ? (
          <button type="button" className="btn btn-success w-100" onClick={onAdicionar} disabled={esgotado}
            aria-label={esgotado ? undefined : `Adicionar ${produto.nome} ao carrinho`}>
            {esgotado ? 'Esgotado' : <>Adicionar<span className="d-none d-md-inline"> ao carrinho</span></>}
          </button>
        ) : (
          <>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <button type="button" className="btn btn-outline-success px-3" onClick={diminuir}
                aria-label={`Diminuir a quantidade de ${produto.nome}`}>
                −
              </button>
              <span className="fw-bold fs-5" role="status" aria-live="polite"
                aria-label={`${noCarrinho} no carrinho`}>
                {noCarrinho}
              </span>
              <button type="button" className="btn btn-outline-success px-3" onClick={onAdicionar}
                disabled={noLimite} aria-label={`Aumentar a quantidade de ${produto.nome}`}>
                +
              </button>
            </div>
            {noLimite && <p className="small mt-2 mb-0">Máximo em stock</p>}
          </>
        ))}
      </div>
    </article>
  );
}