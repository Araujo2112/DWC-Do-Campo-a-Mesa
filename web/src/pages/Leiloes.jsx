// Lista de leilões ativos e agendados
import PorImplementar from '../components/PorImplementar.jsx';

export default function Leiloes() {
  return (
    <>
      <h1>Leilões</h1>
      <PorImplementar passo={2}>
        listar <code>GET /api/auctions?estado=ativo</code> (lote, licitação atual, tempo restante)
        com ligação para a sala de cada leilão.
      </PorImplementar>
    </>
  );
}
