import { Link } from 'react-router-dom';

export default function NaoEncontrado() {
  return (
    <>
      <h1>Página não encontrada</h1>
      <Link to="/">Voltar ao catálogo</Link>
    </>
  );
}
