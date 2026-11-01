// Produtor: criar leilão
import PorImplementar from '../../components/PorImplementar.jsx';

export default function NovoLeilao() {
  return (
    <div className="formulario-estreito">
      <h1>Criar leilão</h1>
      <PorImplementar passo={3}>
        formulário com produto, quantidade, preço base, incremento mínimo, duração e início,
        que chama <code>POST /api/auctions</code>.
      </PorImplementar>
    </div>
  );
}
