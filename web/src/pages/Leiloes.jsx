// Lista de leilões ativos e agendados
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

function Restante({ alvo, rotulo }) {
  const ms = useContagem(alvo);
  return <span>{rotulo} <strong>{ms === 0 ? 'agora' : formatarTempo(ms)}</strong></span>;
}

function CartaoLeilao({ leilao, agendado, utilizador }) {
  return (
    <article className="card h-100">
      <div className="card-body d-flex flex-column">
        <h3 className="h6">{leilao.lote}</h3>
        <p className="texto-secundario small mb-2">
          {leilao.produtor.nome}{leilao.produtor.localidade && <> · {leilao.produtor.localidade}</>}
        </p>
        <p className="mb-1">
          {agendado ? 'Preço base ' : 'Licitação atual '}
          <strong>{euro(agendado ? leilao.precoBase : leilao.licitacaoAtual.valor)}</strong>
        </p>
        <p className="small text-muted mb-3">
          {agendado
            ? <Restante alvo={leilao.iniciaEm} rotulo="Começa em" />
            : <Restante alvo={leilao.terminaEm} rotulo="Termina em" />}
          {!agendado && <> · {leilao.numLicitacoes} licitações</>}
        </p>
        <Link to={`/leiloes/${leilao.id}`} className="btn btn-success mt-auto">
          {utilizador ? (agendado ? 'Ver' : 'Entrar na sala') : 'Entra para licitar'}
        </Link>
      </div>
    </article>
  );
}

export default function Leiloes() {
  const { utilizador } = useAuth();
  const [ativos, setAtivos] = useState([]);
  const [agendados, setAgendados] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const [a, b] = await Promise.all([api('/auctions?estado=ativo'), api('/auctions?estado=agendado')]);
      setAtivos(a);
      setAgendados(b);
      setErro('');
    } catch (err) {
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15_000); // novos leilões e leilões que começam ou acabam
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <h1>Leilões</h1>
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}

      <h2 className="h4">Em direto</h2>
      {!aCarregar && ativos.length === 0 && <p className="text-muted">Não há leilões em direto neste momento.</p>}
      <div className="grelha-cartoes mb-4">
        {ativos.map((l) => (
          <div key={l.id}><CartaoLeilao leilao={l} utilizador={utilizador} /></div>
        ))}
      </div>

      {agendados.length > 0 && (
        <>
          <h2 className="h4">Agendados</h2>
          <div className="grelha-cartoes">
            {agendados.map((l) => (
              <div key={l.id}><CartaoLeilao leilao={l} agendado utilizador={utilizador} /></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
