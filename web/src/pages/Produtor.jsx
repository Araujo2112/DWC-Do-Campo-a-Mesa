// Visitante: página pública do produtor
import { useParams } from 'react-router-dom';
import PorImplementar from '../components/PorImplementar.jsx';

export default function Produtor() {
  const { id } = useParams();
  return (
    <>
      <h1>Produtor</h1>
      <PorImplementar passo={2}>
        obter <code>GET /api/producers/{id}</code> e mostrar apresentação, localização em mapa,
        avaliação média e produtos disponíveis.
      </PorImplementar>
    </>
  );
}
