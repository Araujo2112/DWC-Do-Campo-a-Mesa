// Produtor: painel de gestão (catálogo e encomendas)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import ProdutoForm from '../../components/ProdutoForm.jsx';
import PorImplementar from '../../components/PorImplementar.jsx';

const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];
const ACAO_SEGUINTE = {
  pendente: 'Confirmar',
  confirmada: 'Marcar como pronta',
  pronta: 'Marcar como entregue',
};
const STOCK_BAIXO = 10;

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function PainelProdutor() {
  const { utilizador, token, sair } = useAuth();
  const validado = utilizador.produtor?.validado === true;

  const [produtos, setProdutos] = useState([]);
  const [encomendas, setEncomendas] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [emEdicao, setEmEdicao] = useState(null); // null | 'novo' | produto
  const [erroForm, setErroForm] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [aTrabalhar, setATrabalhar] = useState(null); // id do produto ou da encomenda com um pedido em curso

  function falhou(err, definir) {
    if (err.status === 401) return sair(); // token expirado
    definir(err.status ? err.message : 'Não foi possível contactar o servidor');
  }

  async function carregar() {
    try {
      const [prods, encs] = await Promise.all([
        api(`/products?produtor=${utilizador.id}&ordenar=nome`),
        api('/orders', { token }),
      ]);
      setProdutos(prods);
      setEncomendas(encs);
      setErro('');
    } catch (err) {
      falhou(err, setErro);
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function guardar(dados) {
    setErroForm('');
    setAGuardar(true);
    try {
      if (emEdicao === 'novo') {
        await api('/products', { metodo: 'POST', corpo: dados, token });
      } else {
        await api(`/products/${emEdicao._id}`, { metodo: 'PUT', corpo: dados, token });
      }
      setEmEdicao(null);
      await carregar();
    } catch (err) {
      falhou(err, setErroForm);
    } finally {
      setAGuardar(false);
    }
  }

  async function apagar(p) {
    if (!window.confirm(`Apagar "${p.nome}"?`)) return;
    setATrabalhar(p._id);
    try {
      await api(`/products/${p._id}`, { metodo: 'DELETE', token });
      await carregar();
    } catch (err) {
      falhou(err, setErro);
    } finally {
      setATrabalhar(null);
    }
  }

  async function avancar(o) {
    const seguinte = ESTADOS[ESTADOS.indexOf(o.estado) + 1];
    setATrabalhar(o.id);
    try {
      await api(`/orders/${o.id}/estado`, { metodo: 'PATCH', corpo: { estado: seguinte }, token });
      await carregar();
    } catch (err) {
      falhou(err, setErro);
    } finally {
      setATrabalhar(null);
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="mb-0">Painel do produtor</h1>
        <Link to="/produtor/leiloes/novo" className="btn btn-success">Criar leilão</Link>
      </div>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}

      {/* ---------- Catálogo ---------- */}
      <section aria-labelledby="titulo-catalogo" className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 id="titulo-catalogo" className="h4 mb-0">Os meus produtos</h2>
          <button
            type="button"
            className="btn btn-outline-success"
            disabled={!validado || emEdicao !== null}
            onClick={() => { setErroForm(''); setEmEdicao('novo'); }}
          >
            Novo produto
          </button>
        </div>

        {emEdicao !== null && (
          <ProdutoForm
            key={emEdicao === 'novo' ? 'novo' : emEdicao._id}
            inicial={emEdicao === 'novo' ? null : emEdicao}
            aGuardar={aGuardar}
            erro={erroForm}
            onGuardar={guardar}
            onCancelar={() => setEmEdicao(null)}
          />
        )}

        {!aCarregar && produtos.length === 0 && <p className="text-muted">Ainda não tens produtos.</p>}
        <ul className="list-group">
          {produtos.map((p) => (
            <li key={p._id}
              className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div>
                <strong>{p.nome}</strong>{' '}
                {p.biologico && <span className="badge text-bg-success">BIO</span>}
                <div className="small text-muted">
                  {p.categoria} · {euro(p.preco)} / {p.unidade} · stock: {p.stock}{' '}
                  {p.stock <= STOCK_BAIXO && <span className="badge text-bg-warning">Stock baixo</span>}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary"
                  disabled={!validado || emEdicao !== null}
                  onClick={() => { setErroForm(''); setEmEdicao(p); }}>
                  Editar
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger"
                  disabled={!validado || aTrabalhar === p._id}
                  onClick={() => apagar(p)}>
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Encomendas ---------- */}
      <section aria-labelledby="titulo-encomendas" className="mb-4">
        <h2 id="titulo-encomendas" className="h4">Encomendas recebidas</h2>
        {!aCarregar && encomendas.length === 0 && <p className="text-muted">Ainda não recebeste encomendas.</p>}
        <ul className="list-group">
          {encomendas.map((o) => (
            <li key={o.id} className="list-group-item">
              <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                <div>
                  <strong>#{o.id.slice(-6).toUpperCase()}</strong> · {o.comprador.nome} ·{' '}
                  <span className="badge text-bg-secondary">{o.estado}</span>
                  <div className="small">
                    {o.linhas.map((l) => `${l.quantidade} × ${l.nome}`).join(', ')}
                  </div>
                  <div className="small text-muted">
                    {euro(o.total)} ·{' '}
                    {o.entrega.tipo === 'entrega' ? `Entrega: ${o.entrega.morada}` : 'Levantamento'}
                  </div>
                </div>
                {ACAO_SEGUINTE[o.estado] && (
                  <div>
                    <button type="button" className="btn btn-success"
                      disabled={!validado || aTrabalhar === o.id}
                      onClick={() => avancar(o)}>
                      {ACAO_SEGUINTE[o.estado]}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <PorImplementar passo={3}>
        indicadores (vendas do mês, avaliação média) e upload de imagem dos produtos (Passo 8).
      </PorImplementar>
    </>
  );
}