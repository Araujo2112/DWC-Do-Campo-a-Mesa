import { useEffect, useState } from 'react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import DestaqueLeilao from '../components/DestaqueLeilao.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';

const CATEGORIAS = ['Todos', 'Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria'];
const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
const ORDENACOES = [
  ['recentes', 'Mais recentes'],
  ['nome', 'Nome (A–Z)'],
  ['preco_asc', 'Preço: mais baixo'],
  ['preco_desc', 'Preço: mais alto'],
];

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState({ q: '', categoria: 'Todos', bio: false, epoca: '', localidade: '', produtor: '', ordenar: 'recentes' });
  const [produtores, setProdutores] = useState([]);
  const [erro, setErro] = useState('');
  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) return;
    api('/producers').then(setProdutores).catch(() => setProdutores([]));
  }, []);

  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) {
      setProdutos(produtosSimulados.filter((p) =>
        (filtro.categoria === 'Todos' || p.categoria === filtro.categoria) &&
        (!filtro.bio || p.biologico) &&
        p.nome.toLowerCase().includes(filtro.q.toLowerCase())));
      return;
    }
    // A API recusa valores vazios ou desconhecidos: só se enviam os filtros ativos.
    const q = new URLSearchParams();
    if (filtro.q.trim()) q.set('q', filtro.q.trim());
    if (filtro.categoria !== 'Todos') q.set('categoria', filtro.categoria);
    if (filtro.bio) q.set('bio', 'true');
    if (filtro.epoca) q.set('epoca', filtro.epoca);
    if (filtro.localidade) q.set('localidade', filtro.localidade);
    if (filtro.produtor) q.set('produtor', filtro.produtor);
    if (filtro.ordenar !== 'recentes') q.set('ordenar', filtro.ordenar);
    api(`/products?${q}`).then(setProdutos).catch((e) => setErro(e.message));
  }, [filtro]);

  const mudar = (campo) => (e) =>
    setFiltro((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const localidades = [...new Set(produtores.map((p) => p.localidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  const produtoresVisiveis = produtores.filter((p) => !filtro.localidade || p.localidade === filtro.localidade);

  return (
    <>
      <section className="hero mb-4" aria-label="Apresentação">
        <div>
          <p className="hero__etiqueta">Alto Minho · Produção local</p>
          <h1>Direto de quem produz, para a sua mesa.</h1>
          <p className="texto-secundario hero__texto">
            Produtores do Alto Minho. Encomende ou dispute os lotes da época nos leilões em direto.
          </p>
        </div>
        <DestaqueLeilao />
      </section>

      <section className="filtros mb-4" aria-label="Filtros">
        <label className="visually-hidden" htmlFor="pesquisa">Pesquisar</label>
        <input id="pesquisa" type="search" className="form-control rounded-pill filtros__pesquisa"
          placeholder="Pesquisar kiwi, mel, Alvarinho, produtor…" value={filtro.q} onChange={mudar('q')} />

        <div className="d-flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button key={c} type="button" aria-pressed={filtro.categoria === c}
              className={`btn btn-sm rounded-pill px-3 ${filtro.categoria === c ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setFiltro((f) => ({ ...f, categoria: c }))}>{c}</button>
          ))}
        </div>

        <div className="filtros__opcoes">
          <div className="form-check filtros__bio">
            <input id="bio" className="form-check-input" type="checkbox" checked={filtro.bio} onChange={mudar('bio')} />
            <label className="form-check-label" htmlFor="bio">Só biológico</label>
          </div>
          <div className="filtros__campo">
            <label htmlFor="epoca">Época</label>
            <select id="epoca" className="form-select form-select-sm rounded-pill"
              value={filtro.epoca} onChange={mudar('epoca')}>
              <option value="">Todas</option>
              {EPOCAS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="filtros__campo">
            <label htmlFor="localidade">Localidade</label>
            <select id="localidade" className="form-select form-select-sm rounded-pill"
              value={filtro.localidade}
              onChange={(e) => setFiltro((f) => ({ ...f, localidade: e.target.value, produtor: '' }))}>
              <option value="">Todas</option>
              {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="filtros__campo">
            <label htmlFor="produtor">Produtor</label>
            <select id="produtor" className="form-select form-select-sm rounded-pill"
              value={filtro.produtor} onChange={mudar('produtor')}>
              <option value="">Todos</option>
              {produtoresVisiveis.map((p) => <option key={p.id} value={p.id}>{p.nomeExploracao || p.nome}</option>)}
            </select>
          </div>
          <div className="filtros__campo">
            <label htmlFor="ordenar">Ordenar</label>
            <select id="ordenar" className="form-select form-select-sm rounded-pill"
              value={filtro.ordenar} onChange={mudar('ordenar')}>
              {ORDENACOES.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
            </select>
          </div>
        </div>
      </section>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <section className="grelha-produtos" aria-label="Produtos">
        {produtos.map((p) => (
          <CartaoProduto key={p._id} produto={p}
            onAdicionar={utilizador?.papel === 'comprador' ? () => carrinho.adicionar(p) : undefined} />
        ))}
      </section>
      {produtos.length === 0 && <p className="texto-secundario">Nenhum produto encontrado.</p>}
    </>
  );
}
