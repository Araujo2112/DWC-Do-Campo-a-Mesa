import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dados, setDados] = useState({ email: '', password: '' });
  const [erro, setErro] = useState('');

  async function submeter(e) {
    e.preventDefault();
    try {
      await entrar(dados.email, dados.password);
      navigate(location.state?.de || '/');
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Entrar</h1>
      <label htmlFor="email" className="form-label">Email</label>
      <input id="email" type="email" className="form-control mb-3" required
        value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
      <label htmlFor="password" className="form-label">Password</label>
      <input id="password" type="password" className="form-control mb-3" required
        value={dados.password} onChange={(e) => setDados({ ...dados, password: e.target.value })} />
      {erro && <div className="alert alert-danger">{erro}</div>}
      <button type="submit" className="btn btn-success w-100">Entrar</button>
    </form>
  );
}
