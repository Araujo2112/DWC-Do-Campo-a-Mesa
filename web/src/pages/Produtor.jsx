// Visitante: página pública do produtor
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import CartaoProduto from '../components/CartaoProduto.jsx';
import PorImplementar from '../components/PorImplementar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

export default function Produtor() {
  const { id } = useParams();
  const { utilizador } = useAuth();
  const carrinho = useCarrinho();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setDados(null);
    setErro('');
    api(`/producers/${id}`)
      .then(setDados)
      .catch((err) => setErro(err.status === 404 ? 'Produtor não encontrado.' : err.message));
  }, [id]);

  if (erro) return <div className="alert alert-warning" role="alert">{erro}</div>;
  if (!dados) return <p>A carregar...</p>;

  const { produtor, produtos, avaliacaoMedia, numAvaliacoes } = dados;

  // Dá a cada produto o produtor em objeto, como nas listagens do catálogo (cartão e carrinho).
  const donoDosProdutos = {
    _id: produtor.id,
    nome: produtor.nome,
    produtor: { localidade: produtor.localidade },
  };

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1">{produtor.nomeExploracao || produtor.nome}</h1>
        <p className="texto-secundario mb-1">{produtor.localidade}</p>
        <p className="mb-2">
          {avaliacaoMedia === null
            ? 'Ainda sem avaliações'
            : `★ ${avaliacaoMedia.toLocaleString('pt-PT')} · ${numAvaliacoes} avaliações`}
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
            onAdicionar={utilizador?.papel === 'comprador'
              ? () => carrinho.adicionar({ ...p, produtor: donoDosProdutos })
              : undefined}
          />
        ))}
      </section>

      <PorImplementar passo={2}>
        localização do produtor em mapa e lista de avaliações.
      </PorImplementar>
    </>
  );
}