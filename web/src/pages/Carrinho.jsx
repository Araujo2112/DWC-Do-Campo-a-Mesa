import { useCarrinho } from '../context/CarrinhoContext.jsx';
import PorImplementar from '../components/PorImplementar.jsx';

export default function Carrinho() {
  const { linhas, remover, total } = useCarrinho();
  return (
    <>
      <h1>Carrinho</h1>
      {linhas.length === 0 ? <p>O carrinho está vazio.</p> : (
        <ul className="list-group mb-3">
          {linhas.map(({ produto, quantidade }) => (
            <li key={produto._id} className="list-group-item d-flex justify-content-between align-items-center">
              <span>{quantidade} × {produto.nome}</span>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remover(produto._id)}>Remover</button>
            </li>
          ))}
        </ul>
      )}
      <p className="fw-bold">Total: {total.toFixed(2)} €</p>
      <PorImplementar passo={3}>
        escolher levantamento ou entrega e submeter com <code>POST /api/orders</code> (uma encomenda por produtor).
      </PorImplementar>
    </>
  );
}
