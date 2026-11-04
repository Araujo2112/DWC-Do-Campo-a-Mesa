// Componente reutilizável: cartão de produto do catálogo
import { Link } from 'react-router-dom';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function CartaoProduto({ produto, onAdicionar }) {
  // Nas listagens o produtor vem como objeto (nome e localidade); noutros casos só vem o id.
  const dono = produto.produtor && typeof produto.produtor === 'object' ? produto.produtor : null;
  const esgotado = produto.stock <= 0;

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
        {esgotado && <p className="texto-secundario small mb-2">Esgotado</p>}
        {onAdicionar && (
          <button type="button" className="btn btn-success w-100" onClick={onAdicionar} disabled={esgotado}>
            {esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
          </button>
        )}
      </div>
    </article>
  );
}