import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DESTINO_POR_PAPEL = {
  comprador: '/',
  produtor: '/produtor',
  admin: '/admin',
};

export default function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dados, setDados] = useState({ email: '', password: '' });
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setAEnviar(true);
    try {
      const utilizador = await entrar(dados.email, dados.password);
      // Se veio de uma página protegida, volta lá; senão vai para a página do seu papel.
      navigate(location.state?.de || DESTINO_POR_PAPEL[utilizador.papel] || '/');
    } catch (err) {
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Entrar</h1>

      <label htmlFor="email" className="form-label">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        className="form-control mb-3"
        required
        value={dados.email}
        onChange={(e) => setDados({ ...dados, email: e.target.value })}
      />

      <label htmlFor="password" className="form-label">Password</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        className="form-control mb-3"
        required
        value={dados.password}
        onChange={(e) => setDados({ ...dados, password: e.target.value })}
      />

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

      <button type="submit" className="btn btn-success w-100" disabled={aEnviar}>
        {aEnviar ? 'A entrar...' : 'Entrar'}
      </button>
    </form>
  );
}