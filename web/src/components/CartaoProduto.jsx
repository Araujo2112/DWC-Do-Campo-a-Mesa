import { Link } from 'react-router-dom';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function CartaoProduto({ produto, onAdicionar }) {
  const { quantidadeDe, alterar, remover } = useCarrinho();

  const dono = produto.produtor && typeof produto.produtor === 'object' ? produto.produtor : null;
  const esgotado = produto.stock <= 0;
  const noCarrinho = onAdicionar ? quantidadeDe(produto._id) : 0;
  const noLimite = noCarrinho >= produto.stock;

  // Com 1 unidade, o "−" tira o produto do carrinho e volta o botão "Adicionar".
  const diminuir = () => (noCarrinho <= 1 ? remover(produto._id) : alterar(produto._id, noCarrinho - 1));

  return (
    <article className="card cartao-produto h-100">
      {produto.imagemUrl ? (
        <img src={produto.imagemUrl} className="card-img-top" alt={produto.nome} />
      ) : (
        <div className="cartao-produto__imagem" aria-hidden="true" />
      )}
      <div className="card-body d-flex flex-column">
        {produto.biologico && <span className="etiqueta-bio">BIO</span>}
        <h3 className="h6 mb-1">{produto.nome}</h3>
        {dono && (
          <p className="texto-secundario small mb-2">
            <Link to={`/produtores/${dono._id}`} className="text-reset">{dono.nome}</Link>
            {dono.produtor?.localidade && <> · {dono.produtor.localidade}</>}
          </p>
        )}
        <p className="preco mt-auto">
          {euro(produto.preco)} <span className="texto-secundario small">/ {produto.unidade}</span>
        </p>

        {onAdicionar && (noCarrinho === 0 ? (
          <button type="button" className="btn btn-success w-100" onClick={onAdicionar} disabled={esgotado}>
            {esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
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