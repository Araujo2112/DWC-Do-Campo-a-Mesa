// Produtor: criar leilão
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';

const DURACOES = [
  [15, '15 min'],
  [30, '30 min'],
  [60, '1 h'],
  [120, '2 h'],
];

export default function NovoLeilao() {
  const { utilizador, token, sair } = useAuth();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [d, setD] = useState({
    produto: '', lote: '', quantidade: '', precoBase: '', incremento: '5',
    duracao: '30', agendar: false, iniciaEm: '',
  });
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    api(`/products?produtor=${utilizador.id}&ordenar=nome`).then(setProdutos).catch(() => setProdutos([]));
  }, [utilizador.id]);

  const atualizar = (campo) => (e) =>
    setD((x) => ({ ...x, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function escolherProduto(e) {
    const id = e.target.value;
    const p = produtos.find((x) => x._id === id);
    // Sugere o nome do produto como lote, se ainda não escreveste nada
    setD((x) => ({ ...x, produto: id, lote: x.lote === '' && p ? p.nome : x.lote }));
  }

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setAEnviar(true);
    try {
      const corpo = {
        produto: d.produto || undefined,
        lote: d.lote.trim(),
        quantidade: d.quantidade.trim() || undefined,
        precoBase: Number(d.precoBase),
        incremento: Number(d.incremento),
        duracaoMinutos: Number(d.duracao),
        iniciaEm: d.agendar ? new Date(d.iniciaEm).toISOString() : undefined,
      };
      const criado = await api('/auctions', { metodo: 'POST', corpo, token });
      navigate(`/leiloes/${criado.id}`);
    } catch (err) {
      if (err.status === 401) return sair();
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Criar leilão</h1>

      <label htmlFor="produto" className="form-label">Produto (opcional)</label>
      <select id="produto" className="form-select mb-3" value={d.produto} onChange={escolherProduto}>
        <option value="">Sem produto associado</option>
        {produtos.map((p) => <option key={p._id} value={p._id}>{p.nome}</option>)}
      </select>

      <label htmlFor="lote" className="form-label">Lote</label>
      <input id="lote" type="text" className="form-control mb-3" required maxLength={120}
        placeholder="200 kg de kiwi Hayward, calibre A" value={d.lote} onChange={atualizar('lote')} />

      <label htmlFor="quantidade" className="form-label">Quantidade (opcional)</label>
      <input id="quantidade" type="text" className="form-control mb-3" maxLength={40}
        placeholder="200 kg" value={d.quantidade} onChange={atualizar('quantidade')} />

      <div className="row g-3 mb-3">
        <div className="col-6">
          <label htmlFor="precoBase" className="form-label">Preço base (€)</label>
          <input id="precoBase" type="number" className="form-control" required min="0" step="0.01"
            value={d.precoBase} onChange={atualizar('precoBase')} />
        </div>
        <div className="col-6">
          <label htmlFor="incremento" className="form-label">Incremento mínimo (€)</label>
          <input id="incremento" type="number" className="form-control" required min="0.01" step="0.01"
            value={d.incremento} onChange={atualizar('incremento')} />
        </div>
      </div>

      <fieldset className="mb-3">
        <legend className="form-label fs-6">Duração</legend>
        <div className="d-flex flex-wrap gap-2 mb-2">
          {DURACOES.map(([minutos, rotulo]) => (
            <button key={minutos} type="button"
              className={`btn btn-sm ${Number(d.duracao) === minutos ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setD((x) => ({ ...x, duracao: String(minutos) }))}>
              {rotulo}
            </button>
          ))}
        </div>
        <label htmlFor="duracao" className="form-label small">Outra (minutos)</label>
        <input id="duracao" type="number" className="form-control" required min="1" max="1440" step="1"
          value={d.duracao} onChange={atualizar('duracao')} />
      </fieldset>

      <div className="form-check mb-2">
        <input id="agendar" type="checkbox" className="form-check-input" checked={d.agendar} onChange={atualizar('agendar')} />
        <label htmlFor="agendar" className="form-check-label">Agendar o início (senão começa já)</label>
      </div>
      {d.agendar && (
        <div className="mb-3">
          <label htmlFor="iniciaEm" className="form-label">Início</label>
          <input id="iniciaEm" type="datetime-local" className="form-control" required
            value={d.iniciaEm} onChange={atualizar('iniciaEm')} />
        </div>
      )}

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

      <button type="submit" className="btn btn-success w-100" disabled={aEnviar}>
        {aEnviar ? 'A publicar...' : d.agendar ? 'Agendar leilão' : 'Publicar leilão'}
      </button>
    </form>
  );
}
