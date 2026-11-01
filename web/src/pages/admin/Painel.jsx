// Administrador: validação de produtores, moderação e estatísticas
import PorImplementar from '../../components/PorImplementar.jsx';

export default function PainelAdmin() {
  return (
    <>
      <h1>Administração</h1>
      <PorImplementar passo={3}>
        estatísticas (<code>GET /api/admin/estatisticas</code>), produtores por validar,
        avaliações denunciadas e lista de leilões ativos.
      </PorImplementar>
    </>
  );
}
