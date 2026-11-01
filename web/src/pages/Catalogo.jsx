// Visitante: catálogo com pesquisa e filtros
import { useEffect, useState } from 'react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';

const CATEGORIAS = ['Todos', 'Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria'];

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState({ q: '', categoria: 'Todos', bio: false });
  const [erro, setErro] = useState('');
  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) {
      // Semana 2: filtragem local sobre dados simulados
      setProdutos(produtosSimulados.filter((p) =>
        (filtro.categoria === 'Todos' || p.categoria === filtro.categoria) &&
        (!filtro.bio || p.biologico) &&
        p.nome.toLowerCase().includes(filtro.q.toLowerCase())));
      return;
    }
    const q = new URLSearchParams(filtro);
    api(`/products?${q}`).then(setProdutos).catch((e) => setErro(e.message));
  }, [filtro]);

  const mudar = (campo) => (e) =>
    setFiltro((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <section className="destaque mb-4">
        <h1>Direto de quem produz, para a sua mesa.</h1>
        <p className="texto-secundario">Produtores do Alto Minho. Encomende ou dispute os lotes da época nos leilões em direto.</p>
        {/* TODO: cartão com o leilão em direto em destaque */}
      </section>

      <section className="filtros mb-3" aria-label="Filtros">
        <label className="visually-hidden" htmlFor="pesquisa">Pesquisar</label>
        <input id="pesquisa" type="search" className="form-control" placeholder="Pesquisar kiwi, mel, Alvarinho…"
          value={filtro.q} onChange={mudar('q')} />
        <div className="d-flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button key={c} type="button"
              className={`btn btn-sm ${filtro.categoria === c ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setFiltro((f) => ({ ...f, categoria: c }))}>{c}</button>
          ))}
        </div>
        <div className="form-check">
          <input id="bio" className="form-check-input" type="checkbox" checked={filtro.bio} onChange={mudar('bio')} />
          <label className="form-check-label" htmlFor="bio">Só biológico</label>
        </div>
        {/* TODO: filtros por época, preço máximo e ordenação */}
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
