// Comprador: carrinho e checkout
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function Carrinho() {
  const { linhas, alterar, remover, esvaziar, total } = useCarrinho();
  const { token, sair } = useAuth();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  async function encomendar(e) {
    e.preventDefault();
    setErro('');
    setAEnviar(true);
    try {
      const corpo = {
        linhas: linhas.map(({ produto, quantidade }) => ({ produto: produto._id, quantidade })),
        entrega: tipo === 'entrega' ? { tipo, morada } : { tipo },
      };
      await api('/orders', { metodo: 'POST', corpo, token });
      esvaziar();
      navigate('/encomendas');
    } catch (err) {
      if (err.status === 401) return sair();
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setAEnviar(false);
    }
  }

  if (linhas.length === 0) {
    return (
      <>
        <h1>Carrinho</h1>
        <p>O carrinho está vazio.</p>
        <Link to="/" className="btn btn-success">Ver produtos</Link>
      </>
    );
  }

  return (
    <form onSubmit={encomendar}>
      <h1>Carrinho</h1>

      <ul className="list-group mb-3">
        {linhas.map(({ produto, quantidade }) => (
          <li key={produto._id}
            className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
            <div>
              <strong>{produto.nome}</strong>
              <div className="small text-muted">
                {produto.produtor?.nome} · {euro(produto.preco)} / {produto.unidade}
              </div>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <label htmlFor={`qtd-${produto._id}`} className="visually-hidden">Quantidade de {produto.nome}</label>
              <input
                id={`qtd-${produto._id}`}
                type="number"
                className="form-control"
                style={{ width: '5.5rem' }}
                min="1"
                max={produto.stock}
                step="1"
                value={quantidade}
                onChange={(e) => alterar(produto._id, parseInt(e.target.value, 10))}
              />
              <span className="text-nowrap">{euro(produto.preco * quantidade)}</span>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remover(produto._id)}>
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>

      <fieldset className="mb-3">
        <legend className="form-label fs-6">Como queres receber?</legend>
        <div className="form-check form-check-inline">
          <input id="tipo-levantamento" type="radio" name="tipo" className="form-check-input"
            checked={tipo === 'levantamento'} onChange={() => setTipo('levantamento')} />
          <label htmlFor="tipo-levantamento" className="form-check-label">Levantar no produtor</label>
        </div>
        <div className="form-check form-check-inline">
          <input id="tipo-entrega" type="radio" name="tipo" className="form-check-input"
            checked={tipo === 'entrega'} onChange={() => setTipo('entrega')} />
          <label htmlFor="tipo-entrega" className="form-check-label">Entrega em casa</label>
        </div>
      </fieldset>

      {tipo === 'entrega' && (
        <div className="mb-3">
          <label htmlFor="morada" className="form-label">Morada de entrega</label>
          <input id="morada" type="text" className="form-control" required maxLength={200}
            value={morada} onChange={(e) => setMorada(e.target.value)} />
        </div>
      )}

      <p className="fw-bold fs-5">Total: {euro(total)}</p>
      <p className="text-muted small">
        Se houver produtos de vários produtores, é criada uma encomenda por produtor. O preço final é o do servidor.
      </p>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

      <button type="submit" className="btn btn-success btn-movel-bloco" disabled={aEnviar}>
        {aEnviar ? 'A encomendar...' : 'Encomendar'}
      </button>
    </form>
  );
}