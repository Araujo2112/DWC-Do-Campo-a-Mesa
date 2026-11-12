import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotificacoes } from '../../hooks/useNotificacoes.js';
import { useContagem, formatarTempo } from '../../hooks/useContagem.js';
import ProdutoForm from '../../components/ProdutoForm.jsx';
import PorImplementar from '../../components/PorImplementar.jsx';

const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];
const ACAO_SEGUINTE = {
  pendente: 'Confirmar',
  confirmada: 'Marcar como pronta',
  pronta: 'Marcar como entregue',
};
const STOCK_BAIXO = 10;
const ROTULO_LEILAO = { agendado: 'Agendado', ativo: 'Em direto', terminado: 'Terminado' };

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const codigo = (id) => `#${String(id).slice(-6).toUpperCase()}`;

function Restante({ alvo }) {
  const ms = useContagem(alvo);
  return <>{ms === 0 ? 'agora' : formatarTempo(ms)}</>;
}

export default function PainelProdutor() {
  const { utilizador, token, sair } = useAuth();
  const validado = utilizador.produtor?.validado === true;

  const [produtos, setProdutos] = useState([]);
  const [encomendas, setEncomendas] = useState([]);
  const [leiloes, setLeiloes] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [emEdicao, setEmEdicao] = useState(null); // null | 'novo' | produto
  const [erroForm, setErroForm] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [aTrabalhar, setATrabalhar] = useState(null);

  function falhou(err, definir) {
    if (err.status === 401) return sair();
    definir(err.status ? err.message : 'Não foi possível contactar o servidor');
  }

  async function carregar() {
    try {
      const [prods, encs, est, leis] = await Promise.all([
        api(`/products?produtor=${utilizador.id}&ordenar=nome`),
        api('/orders', { token }),
        api('/producers/me/estatisticas', { token }),
        api(`/auctions?produtor=${utilizador.id}`),
      ]);
      setProdutos(prods);
      setEncomendas(encs);
      setEstatisticas(est);
      setLeiloes(leis);
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

  function avisar(texto) {
    setAvisos((lista) => [...lista.slice(-2), { id: Date.now() + Math.random(), texto }]);
  }

  useNotificacoes(token, (evento, dados) => {
    if (evento === 'encomenda-nova') {
      avisar(`Nova encomenda ${codigo(dados.id)}, de ${euro(dados.total)}.`);
      carregar();
    }
    if (evento === 'leilao-terminado') {
      avisar(dados.vencedor
        ? `O leilão "${dados.lote}" terminou: ${dados.vencedor.nome} ganhou por ${euro(dados.valor)}.`
        : `O leilão "${dados.lote}" terminou sem licitações.`);
      carregar();
    }
  });

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

  const indicadores = estatisticas && [
    ['Vendas no mês', euro(estatisticas.vendasMes), `${estatisticas.encomendasMes} ${estatisticas.encomendasMes === 1 ? 'encomenda' : 'encomendas'}`],
    ['Encomendas por tratar', estatisticas.encomendasPorTratar, 'pendentes'],
    ['Produtos ativos', estatisticas.produtosAtivos,
      estatisticas.produtosComStockBaixo > 0 ? `${estatisticas.produtosComStockBaixo} com stock baixo` : 'stock em ordem'],
    ['Avaliação média',
      estatisticas.avaliacaoMedia === null ? '—' : `★ ${estatisticas.avaliacaoMedia.toLocaleString('pt-PT')}`,
      `${estatisticas.numAvaliacoes} ${estatisticas.numAvaliacoes === 1 ? 'avaliação' : 'avaliações'}`],
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="mb-0">Painel do produtor</h1>
        <div className="d-flex gap-2">
          <Link to="/produtor/perfil" className="btn btn-outline-secondary">Perfil público</Link>
          <Link to="/produtor/leiloes/novo" className="btn btn-success">Criar leilão</Link>
        </div>
      </div>

      {avisos.map((a) => (
        <div key={a.id} className="alert alert-success d-flex justify-content-between align-items-center" role="status">
          <span>{a.texto}</span>
          <button type="button" className="btn-close" aria-label="Fechar aviso"
            onClick={() => setAvisos((lista) => lista.filter((x) => x.id !== a.id))} />
        </div>
      ))}
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p>A carregar...</p>}

      {indicadores && (
        <section aria-label="Indicadores" className="mb-4">
          <div className="row row-cols-2 row-cols-lg-4 g-3">
            {indicadores.map(([rotulo, valor, detalhe]) => (
              <div className="col" key={rotulo}>
                <div className="card h-100">
                  <div className="card-body">
                    <div className="text-muted small">{rotulo}</div>
                    <div className="fs-3 fw-bold">{valor}</div>
                    <div className="small text-muted">{detalhe}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="titulo-catalogo" className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 id="titulo-catalogo" className="h4 mb-0">Os meus produtos</h2>
          <button type="button" className="btn btn-outline-success"
            disabled={!validado || emEdicao !== null}
            onClick={() => { setErroForm(''); setEmEdicao('novo'); }}>
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

      <section aria-labelledby="titulo-leiloes" className="mb-5">
        <h2 id="titulo-leiloes" className="h4">Os meus leilões</h2>
        {!aCarregar && leiloes.length === 0 && <p className="text-muted">Ainda não criaste leilões.</p>}
        <ul className="list-group">
          {leiloes.map((l) => (
            <li key={l.id}
              className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div>
                <strong>{l.lote}</strong>{' '}
                <span className={`badge ${l.estado === 'ativo' ? 'text-bg-danger' : 'text-bg-secondary'}`}>
                  {ROTULO_LEILAO[l.estado]}
                </span>
                <div className="small text-muted">
                  {l.estado === 'agendado' && <>Começa em <Restante alvo={l.iniciaEm} /> · preço base {euro(l.precoBase)}</>}
                  {l.estado === 'ativo' && <>Termina em <Restante alvo={l.terminaEm} /> · {l.numLicitacoes} licitações · atual {euro(l.licitacaoAtual.valor)}</>}
                  {l.estado === 'terminado' && (l.numLicitacoes > 0
                    ? <>{l.numLicitacoes} licitações · vendido por {euro(l.licitacaoAtual.valor)}</>
                    : <>Terminou sem licitações</>)}
                </div>
              </div>
              <Link to={`/leiloes/${l.id}`} className="btn btn-sm btn-outline-secondary">Abrir sala</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-encomendas" className="mb-4">
        <h2 id="titulo-encomendas" className="h4">Encomendas recebidas</h2>
        {!aCarregar && encomendas.length === 0 && <p className="text-muted">Ainda não recebeste encomendas.</p>}
        <ul className="list-group">
          {encomendas.map((o) => (
            <li key={o.id} className="list-group-item">
              <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                <div>
                  <strong>{codigo(o.id)}</strong> · {o.comprador.nome} ·{' '}
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

      <PorImplementar passo={8}>upload de imagem dos produtos.</PorImplementar>
    </>
  );
}
