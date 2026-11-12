import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// O nome da conta abre este menu: é por aqui que o produtor chega ao perfil público.
export default function MenuConta() {
  const { utilizador } = useAuth();

  return (
    <div className="dropdown">
      <button type="button" className="btn btn-outline-secondary dropdown-toggle d-inline-flex align-items-center gap-2"
        data-bs-toggle="dropdown" aria-expanded="false" aria-label={`Conta de ${utilizador.nome}`}>
        <span className="nome-conta text-truncate">{utilizador.nome}</span>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        {utilizador.papel === 'produtor' && (
          <>
            <li><Link className="dropdown-item" to="/produtor">Painel</Link></li>
            <li><Link className="dropdown-item" to="/produtor/perfil">Perfil público</Link></li>
            {utilizador.produtor?.validado && (
              <li><Link className="dropdown-item" to={`/produtores/${utilizador.id}`}>Ver a minha página</Link></li>
            )}
          </>
        )}
        {utilizador.papel === 'comprador' && (
          <>
            <li><Link className="dropdown-item" to="/encomendas">As minhas encomendas</Link></li>
            <li><Link className="dropdown-item" to="/carrinho">Carrinho</Link></li>
          </>
        )}
        {utilizador.papel === 'admin' && (
          <li><Link className="dropdown-item" to="/admin">Administração</Link></li>
        )}
      </ul>
    </div>
  );
}
