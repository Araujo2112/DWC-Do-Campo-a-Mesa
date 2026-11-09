// Visitante: página pública do produtor
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import CartaoProduto from '../components/CartaoProduto.jsx';
import PorImplementar from '../components/PorImplementar.jsx';
import ListaAvaliacoes from '../components/ListaAvaliacoes.jsx';
import Estrelas from '../components/Estrelas.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

export default function Produtor() {
  const { id } = useParams();
  const { utilizador, token } = useAuth();
  const carrinho = useCarrinho();
  const [dados, setDados] = useState(null);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [produtoAberto, setProdutoAberto] = useState(null); // produto cujas avaliações estão à vista
  const [avaliacoesProduto, setAvaliacoesProduto] = useState([]);
  const painelRef = useRef(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setDados(null);
    setAvaliacoes([]);
    setProdutoAberto(null);
    setErro('');
    api(`/producers/${id}`)
      .then(setDados)
      .catch((err) => setErro(err.status === 404 ? 'Produtor não encontrado.' : err.message));
    api(`/reviews?produtor=${id}`).then(setAvaliacoes).catch(() => setAvaliacoes([]));
  }, [id]);

  useEffect(() => {
    if (produtoAberto) painelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [produtoAberto]);

  async function verAvaliacoes(p) {
    setProdutoAberto(p);
    setAvaliacoesProduto([]);
    try {
      setAvaliacoesProduto(await api(`/reviews?produto=${p._id}`));
    } catch {
      setAvaliacoesProduto([]);
    }
  }

  if (erro) return <div className="alert alert-warning" role="alert">{erro}</div>;
  if (!dados) return <p>A carregar...</p>;

  const { produtor, produtos, avaliacaoMedia, numAvaliacoes } = dados;

  // Dá a cada produto o produtor em objeto, como nas listagens do catálogo (cartão e carrinho).
  const donoDosProdutos = {
    _id: produtor.id,
    nome: produtor.nome,
    produtor: { localidade: produtor.localidade },
  };

  // Só quem tem sessão (e não é admin) denuncia; o admin modera no painel.
  const aoDenunciar = utilizador && utilizador.papel !== 'admin'
    ? (rid) => api(`/reviews/${rid}/denuncia`, { metodo: 'POST', token })
    : undefined;

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1">{produtor.nomeExploracao || produtor.nome}</h1>
        <p className="texto-secundario mb-1">{produtor.localidade}</p>
        <p className="mb-2">
          <Estrelas media={avaliacaoMedia} total={numAvaliacoes} />
        </p>
        {produtor.descricao && <p>{produtor.descricao}</p>}
      </header>

      <h2 className="h4">Produtos ({produtos.length})</h2>
      {produtos.length === 0 && <p className="texto-secundario">Este produtor ainda não tem produtos.</p>}
      <section className="grelha-produtos mb-4" aria-label="Produtos do produtor">
        {produtos.map((p) => (
          <CartaoProduto
            key={p._id}
            produto={{ ...p, produtor: donoDosProdutos }}
            onVerAvaliacoes={verAvaliacoes}
            onAdicionar={utilizador?.papel === 'comprador'
              ? () => carrinho.adicionar({ ...p, produtor: donoDosProdutos })
              : undefined}
          />
        ))}
      </section>

      {produtoAberto && (
        <section ref={painelRef} className="mb-4" aria-label={`Avaliações de ${produtoAberto.nome}`}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h4 mb-0">Avaliações: {produtoAberto.nome}</h2>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setProdutoAberto(null)}>
              Fechar
            </button>
          </div>
          <ListaAvaliacoes avaliacoes={avaliacoesProduto} aoDenunciar={aoDenunciar} />
        </section>
      )}

      <h2 className="h4">Avaliações do produtor</h2>
      <section className="mb-4" aria-label="Avaliações do produtor">
        <ListaAvaliacoes avaliacoes={avaliacoes} aoDenunciar={aoDenunciar} />
      </section>

      <PorImplementar passo={2}>localização do produtor em mapa.</PorImplementar>
    </>
  );
}