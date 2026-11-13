import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Só o produtor tem menu: o perfil público e a página própria não existem no cabeçalho.
// Comprador e admin já têm as suas ligações no cabeçalho, por isso veem apenas o nome.
export default function MenuConta() {
  const { utilizador } = useAuth();

  if (utilizador.papel !== 'produtor') {
    return <span className="nome-conta-chip" title={utilizador.nome}>{utilizador.nome}</span>;
  }

  return (
    <div className="dropdown">
      <button type="button" className="btn btn-outline-secondary dropdown-toggle d-inline-flex align-items-center gap-2"
        data-bs-toggle="dropdown" aria-expanded="false" aria-label={`Conta de ${utilizador.nome}`}>
        <span className="nome-conta text-truncate">{utilizador.nome}</span>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        <li><Link className="dropdown-item" to="/produtor/perfil">Perfil público</Link></li>
        {utilizador.produtor?.validado && (
          <li><Link className="dropdown-item" to={`/produtores/${utilizador.id}`}>Ver a minha página</Link></li>
        )}
      </ul>
    </div>
  );
}
