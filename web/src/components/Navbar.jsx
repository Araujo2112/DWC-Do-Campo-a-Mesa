import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import Sino from './Sino.jsx';
import MenuConta from './MenuConta.jsx';

function IconeCarrinho() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export default function Navbar() {
  const { utilizador, sair } = useAuth();
  const { quantidadeTotal } = useCarrinho();

  return (
    <header className="barra-topo">
      <nav className="navbar navbar-expand-lg container-xl" aria-label="Navegação principal">
        <Link to="/" className="navbar-brand marca">Do Campo à Mesa</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse"
          data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Abrir menu">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="menu">
          <ul className="navbar-nav me-auto">
            <li className="nav-item"><NavLink to="/" end className="nav-link">Produtos</NavLink></li>
            <li className="nav-item"><NavLink to="/leiloes" className="nav-link">Leilões</NavLink></li>
            {utilizador?.papel === 'comprador' && (
              <li className="nav-item"><NavLink to="/encomendas" className="nav-link">Encomendas</NavLink></li>
            )}
            {utilizador?.papel === 'produtor' && (
              <li className="nav-item"><NavLink to="/produtor" className="nav-link">Painel</NavLink></li>
            )}
            {utilizador?.papel === 'admin' && (
              <li className="nav-item"><NavLink to="/admin" className="nav-link">Administração</NavLink></li>
            )}
          </ul>
          <div className="d-flex gap-2 align-items-center">
            {utilizador?.papel === 'comprador' && (
              <Link to="/carrinho" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                aria-label={`Carrinho, ${quantidadeTotal} ${quantidadeTotal === 1 ? 'unidade' : 'unidades'}`}>
                <IconeCarrinho />
                <span className="badge rounded-pill text-bg-success" aria-hidden="true">{quantidadeTotal}</span>
              </Link>
            )}
            {utilizador ? (
              <>
                <Sino />
                <MenuConta />
                <button type="button" className="btn btn-outline-secondary" onClick={sair}>Sair</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline-secondary">Entrar</Link>
                <Link to="/registo" className="btn btn-success">Registar</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
