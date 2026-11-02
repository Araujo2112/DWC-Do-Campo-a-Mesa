import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function Registo() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState({
    nome: '',
    email: '',
    password: '',
    papel: 'comprador',
    nomeExploracao: '',
    localidade: '',
    descricao: '',
  });
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  const atualizar = (campo) => (e) => setDados({ ...dados, [campo]: e.target.value });
  const eProdutor = dados.papel === 'produtor';

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setAEnviar(true);
    try {
      const corpo = {
        nome: dados.nome,
        email: dados.email,
        password: dados.password,
        papel: dados.papel,
      };
      if (eProdutor) {
        corpo.produtor = {
          nomeExploracao: dados.nomeExploracao,
          localidade: dados.localidade,
          descricao: dados.descricao,
        };
      }
      await api('/auth/registo', { metodo: 'POST', corpo });
      // O registo só devolve { id }, por isso fazemos login logo a seguir.
      await entrar(dados.email, dados.password);
      navigate('/');
    } catch (err) {
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Registar</h1>

      <fieldset className="mb-3">
        <legend className="form-label fs-6">Tipo de conta</legend>
        <div className="form-check form-check-inline">
          <input
            id="papel-comprador"
            type="radio"
            name="papel"
            className="form-check-input"
            value="comprador"
            checked={!eProdutor}
            onChange={atualizar('papel')}
          />
          <label htmlFor="papel-comprador" className="form-check-label">Comprador</label>
        </div>
        <div className="form-check form-check-inline">
          <input
            id="papel-produtor"
            type="radio"
            name="papel"
            className="form-check-input"
            value="produtor"
            checked={eProdutor}
            onChange={atualizar('papel')}
          />
          <label htmlFor="papel-produtor" className="form-check-label">Produtor</label>
        </div>
      </fieldset>

      <label htmlFor="nome" className="form-label">Nome</label>
      <input
        id="nome"
        type="text"
        autoComplete="name"
        className="form-control mb-3"
        required
        value={dados.nome}
        onChange={atualizar('nome')}
      />

      <label htmlFor="email" className="form-label">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        className="form-control mb-3"
        required
        value={dados.email}
        onChange={atualizar('email')}
      />

      <label htmlFor="password" className="form-label">Password</label>
      <input
        id="password"
        type="password"
        autoComplete="new-password"
        className="form-control mb-1"
        required
        minLength={8}
        value={dados.password}
        onChange={atualizar('password')}
      />
      <div className="form-text mb-3">Mínimo de 8 caracteres.</div>

      {eProdutor && (
        <>
          <label htmlFor="nomeExploracao" className="form-label">Nome da exploração</label>
          <input
            id="nomeExploracao"
            type="text"
            className="form-control mb-3"
            required
            value={dados.nomeExploracao}
            onChange={atualizar('nomeExploracao')}
          />

          <label htmlFor="localidade" className="form-label">Localidade</label>
          <input
            id="localidade"
            type="text"
            className="form-control mb-3"
            required
            value={dados.localidade}
            onChange={atualizar('localidade')}
          />

          <label htmlFor="descricao" className="form-label">Descrição (opcional)</label>
          <textarea
            id="descricao"
            rows={3}
            className="form-control mb-1"
            value={dados.descricao}
            onChange={atualizar('descricao')}
          />
          <div className="form-text mb-3">
            A conta de produtor fica a aguardar validação do administrador.
          </div>
        </>
      )}

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

      <button type="submit" className="btn btn-success w-100" disabled={aEnviar}>
        {aEnviar ? 'A registar...' : 'Registar'}
      </button>
    </form>
  );
}