// Formato único dos leilões e das licitações que a API e os sockets devolvem.
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

const idDe = (v) => (v ? String(v) : null);

// Dono do leilão: { id, nome, localidade } se vier populado, só { id } se não.
const dono = (p) => (p && p.nome !== undefined
  ? { id: idDe(p._id), nome: p.nome, localidade: p.produtor?.localidade }
  : { id: idDe(p) });

// Recebe um objeto simples (lean ou toObject), nunca um documento Mongoose.
const publico = (a) => ({
  id: idDe(a._id),
  lote: a.lote,
  quantidade: a.quantidade,
  produto: idDe(a.produto),
  produtor: dono(a.produtor),
  precoBase: a.precoBase,
  incremento: a.incremento,
  licitacaoAtual: {
    valor: a.licitacaoAtual?.valor ?? a.precoBase,
    comprador: idDe(a.licitacaoAtual?.comprador),
  },
  numLicitacoes: a.numLicitacoes ?? 0,
  iniciaEm: a.iniciaEm,
  terminaEm: a.terminaEm,
  estado: a.estado,
});

const licitacao = (b) => ({
  id: idDe(b._id),
  valor: b.valor,
  comprador: idDe(b.comprador),
  nome: b.nome,
  criadoEm: b.createdAt,
});

// As licitações mais altas primeiro (o valor é sempre crescente, por isso é o mesmo que as mais recentes).
async function ultimasLicitacoes(leilaoId, limite = 10) {
  const lista = await Bid.find({ leilao: leilaoId }).sort({ valor: -1 }).limit(limite).lean();
  return lista.map(licitacao);
}

// Estado completo de um leilão, enviado a quem entra na sala.
// "agora" é o relógio do servidor: o cliente calcula o desvio e mostra a contagem certa.
async function montarEstado(leilaoId) {
  const a = await Auction.findById(leilaoId).populate('produtor', 'nome produtor.localidade').lean();
  if (!a) return null;
  return { leilao: publico(a), licitacoes: await ultimasLicitacoes(a._id), agora: Date.now() };
}

module.exports = { publico, licitacao, ultimasLicitacoes, montarEstado };
