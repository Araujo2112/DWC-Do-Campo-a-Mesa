import PorImplementar from '../components/PorImplementar.jsx';

export default function Registo() {
  return (
    <div className="formulario-estreito">
      <h1>Registar</h1>
      <PorImplementar passo={6}>
        formulário de registo (nome, email, password, tipo de conta: comprador ou produtor;
        para produtor: nome da exploração e localidade) que chama <code>POST /api/auth/registo</code>.
      </PorImplementar>
    </div>
  );
}
