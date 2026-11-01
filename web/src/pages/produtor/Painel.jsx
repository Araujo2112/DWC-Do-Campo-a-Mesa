// Produtor: painel de gestão
import { Link } from 'react-router-dom';
import PorImplementar from '../../components/PorImplementar.jsx';

export default function PainelProdutor() {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="mb-0">Painel do produtor</h1>
        <Link to="/produtor/leiloes/novo" className="btn btn-success">Criar leilão</Link>
      </div>
      <PorImplementar passo={3}>
        indicadores (vendas do mês, encomendas por tratar, avaliação média), gestão do catálogo
        (CRUD de produtos com upload de imagem), tabela de encomendas com mudança de estado
        (<code>PATCH /api/orders/:id/estado</code>) e alertas de stock baixo.
      </PorImplementar>
    </>
  );
}
