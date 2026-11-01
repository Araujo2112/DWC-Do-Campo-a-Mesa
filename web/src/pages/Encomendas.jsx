// Comprador: acompanhamento das encomendas
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import PorImplementar from '../components/PorImplementar.jsx';

export default function Encomendas() {
  return (
    <>
      <h1>Encomendas</h1>
      <div className="card p-3 mb-3">
        <p className="fw-bold mb-2">#EXEMPLO · Horta da Ribeira</p>
        <EstadoEncomenda estado="pronta" />
      </div>
      <PorImplementar passo={7}>
        carregar <code>GET /api/orders</code>, atualizar em tempo real com o evento
        <code> encomenda-atualizada</code> e permitir avaliar encomendas entregues.
      </PorImplementar>
    </>
  );
}
