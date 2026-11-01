// Só deixa passar utilizadores autenticados com um dos papéis indicados
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RotaProtegida({ papeis = [] }) {
  const { utilizador } = useAuth();
  const location = useLocation();

  if (!utilizador) return <Navigate to="/login" state={{ de: location.pathname }} replace />;
  if (papeis.length && !papeis.includes(utilizador.papel)) return <Navigate to="/" replace />;
  return <Outlet />;
}
