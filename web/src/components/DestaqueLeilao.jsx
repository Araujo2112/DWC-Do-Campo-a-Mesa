import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

function CartaoLeilao({ leilao, agendado = false }) {
  const restante = useContagem(agendado ? leilao.iniciaEm : leilao.terminaEm);

  return (
    <aside className="leilao-destaque" aria-label={agendado ? 'Próximo leilão' : 'Leilão em direto'}>
      <p className="leilao-destaque__etiqueta">
        {!agendado && <span className="ponto-direto" aria-hidden="true" />}
        {agendado ? 'Próximo leilão' : 'Leilão em direto'}
      </p>
      <h2 className="leilao-destaque__titulo">{leilao.lote}</h2>
      <p className="leilao-destaque__produtor">
        {leilao.produtor.nome}{leilao.produtor.localidade && <> · {leilao.produtor.localidade}</>}
      </p>
      <div className="leilao-destaque__valores">
        <div>
          <span>{agendado ? 'Preço base' : 'Licitação atual'}</span>
          <strong>{euro(agendado ? leilao.precoBase : leilao.licitacaoAtual.valor)}</strong>
        </div>
        <div>
          <span>{agendado ? 'Começa em' : 'Termina em'}</span>
          <strong>{restante === 0 ? 'agora' : formatarTempo(restante)}</strong>
        </div>
      </div>
      <Link to={`/leiloes/${leilao.id}`} className="btn btn-light rounded-pill w-100">
        {agendado ? 'Ver leilão' : 'Entrar para licitar'}
      </Link>
    </aside>
  );
}

function SemLeilao() {
  return (
    <aside className="leilao-destaque" aria-label="Leilões">
      <p className="leilao-destaque__etiqueta">Leilões</p>
      <h2 className="leilao-destaque__titulo">Sem leilões neste momento</h2>
      <p className="leilao-destaque__texto">Os produtores publicam aqui os lotes da época. Volta em breve.</p>
      <Link to="/leiloes" className="btn btn-light rounded-pill w-100">Ver leilões</Link>
    </aside>
  );
}

export default function DestaqueLeilao() {
  const [estado, setEstado] = useState({ aCarregar: true, ativo: null, agendado: null });

  const carregar = useCallback(async () => {
    try {
      const [ativos, agendados] = await Promise.all([
        api('/auctions?estado=ativo'),
        api('/auctions?estado=agendado'),
      ]);
      setEstado({ aCarregar: false, ativo: ativos[0] ?? null, agendado: agendados[0] ?? null });
    } catch {
      setEstado((e) => ({ ...e, aCarregar: false }));
    }
  }, []);

  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) {
      setEstado({ aCarregar: false, ativo: null, agendado: null });
      return undefined;
    }
    carregar();
    const t = setInterval(carregar, 15_000);
    return () => clearInterval(t);
  }, [carregar]);

  if (estado.aCarregar) return <aside className="leilao-destaque leilao-destaque--a-carregar" aria-busy="true" />;
  if (estado.ativo) return <CartaoLeilao leilao={estado.ativo} />;
  if (estado.agendado) return <CartaoLeilao leilao={estado.agendado} agendado />;
  return <SemLeilao />;
}
