// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const { isObjectIdOrHexString } = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const produtorValidado = require('../middleware/produtorValidado');
const idValido = require('../middleware/idValido');
const { publico, licitacao, ultimasLicitacoes } = require('../services/leiloes');

const ESTADOS = ['agendado', 'ativo', 'terminado'];
const UM_DIA_MS = 24 * 3600 * 1000;

const texto = (v) => typeof v === 'string' && v.trim() !== '';
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const duasCasas = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

// Valida o corpo do POST. Devolve só os campos permitidos: o dono, o estado, o valor atual
// e a hora de fim são calculados aqui, nunca vêm do cliente.
function lerLeilao(corpo) {
  const { produto, lote, quantidade, precoBase, incremento, duracaoMinutos, iniciaEm } = corpo || {};

  if (!texto(lote) || lote.trim().length > 120) return { erro: 'lote é obrigatório (máximo 120 caracteres)' };
  if (quantidade !== undefined && (!texto(quantidade) || quantidade.trim().length > 40)) {
    return { erro: 'quantidade tem de ser texto (máximo 40 caracteres)' };
  }
  if (!numero(precoBase, 0, 100000) || !duasCasas(precoBase)) {
    return { erro: 'precoBase tem de ser um número entre 0 e 100000, com duas casas decimais' };
  }
  if (!numero(incremento, 0.01, 100000) || !duasCasas(incremento)) {
    return { erro: 'incremento tem de ser um número entre 0,01 e 100000, com duas casas decimais' };
  }
  if (!numero(duracaoMinutos, 0.25, 1440)) {
    return { erro: 'duracaoMinutos tem de ser um número entre 0,25 e 1440' };
  }
  if (produto !== undefined && (typeof produto !== 'string' || !isObjectIdOrHexString(produto))) {
    return { erro: 'produto inválido' };
  }

  let inicio = null;
  if (iniciaEm !== undefined) {
    const d = typeof iniciaEm === 'string' ? new Date(iniciaEm) : null;
    if (!d || Number.isNaN(d.getTime())) return { erro: 'iniciaEm tem de ser uma data ISO válida' };
    if (d.getTime() < Date.now() - 60_000) return { erro: 'iniciaEm não pode estar no passado' };
    if (d.getTime() > Date.now() + 30 * UM_DIA_MS) return { erro: 'iniciaEm não pode ser daqui a mais de 30 dias' };
    inicio = d;
  }

  return {
    produto,
    inicio,
    duracaoMinutos,
    dados: {
      lote: lote.trim(),
      quantidade: quantidade === undefined ? undefined : quantidade.trim(),
      precoBase,
      incremento,
    },
  };
}

// GET /api/auctions?estado=&produtor=  -> 200 [leilões] | 400
router.get('/', async (req, res, next) => {
  try {
    const { estado, produtor } = req.query;
    for (const v of [estado, produtor]) {
      if (v !== undefined && typeof v !== 'string') {
        return res.status(400).json({ erro: 'Parâmetros de pesquisa inválidos' });
      }
    }
    if (estado && !ESTADOS.includes(estado)) {
      return res.status(400).json({ erro: `estado tem de ser um de: ${ESTADOS.join(', ')}` });
    }
    if (produtor && !isObjectIdOrHexString(produtor)) {
      return res.status(400).json({ erro: 'produtor inválido' });
    }

    const filtro = {};
    if (estado) filtro.estado = estado;
    if (produtor) filtro.produtor = produtor;

    // Ativos: os que terminam primeiro; agendados: os que começam primeiro; resto: os mais recentes
    const ordem = estado === 'ativo' ? { terminaEm: 1 } : estado === 'agendado' ? { iniciaEm: 1 } : { iniciaEm: -1 };
    const lista = await Auction.find(filtro)
      .sort(ordem)
      .limit(100)
      .populate('produtor', 'nome produtor.localidade')
      .lean();
    res.json(lista.map(publico));
  } catch (err) { next(err); }
});

// GET /api/auctions/:id  -> 200 leilão + últimas licitações | 400 | 404
router.get('/:id', idValido(), async (req, res, next) => {
  try {
    const a = await Auction.findById(req.params.id).populate('produtor', 'nome produtor.localidade').lean();
    if (!a) return res.status(404).json({ erro: 'Leilão não encontrado' });
    res.json({ ...publico(a), licitacoes: await ultimasLicitacoes(a._id) });
  } catch (err) { next(err); }
});

// POST /api/auctions  (produtor validado)  -> 201 + Location | 400 | 401 | 403
// Corpo: { lote, quantidade?, produto?, precoBase, incremento, duracaoMinutos, iniciaEm? }
router.post('/', auth('produtor'), produtorValidado, async (req, res, next) => {
  try {
    const { erro, dados, produto, inicio, duracaoMinutos } = lerLeilao(req.body);
    if (erro) return res.status(400).json({ erro });

    // O produto, se vier, tem de ser do próprio produtor
    if (produto && !(await Product.exists({ _id: produto, produtor: req.user.id }))) {
      return res.status(400).json({ erro: 'produto inválido' });
    }

    const agora = new Date();
    const comeco = inicio && inicio > agora ? inicio : agora;
    const a = await Auction.create({
      ...dados,
      produto,
      produtor: req.user.id,
      licitacaoAtual: { valor: dados.precoBase }, // começa no preço base
      iniciaEm: comeco,
      terminaEm: new Date(comeco.getTime() + Math.round(duracaoMinutos * 60_000)),
      estado: comeco > agora ? 'agendado' : 'ativo',
    });

    res.status(201).location(`/api/auctions/${a._id}`).json(publico(a.toObject()));
  } catch (err) { next(err); }
});

// GET /api/auctions/:id/bids?limite=  -> 200 [licitações, da mais alta para a mais baixa] | 400 | 404
router.get('/:id/bids', idValido(), async (req, res, next) => {
  try {
    const { limite } = req.query;
    let n = 50;
    if (limite !== undefined) {
      n = typeof limite === 'string' && /^\d+$/.test(limite) ? Number(limite) : NaN;
      if (!(n >= 1 && n <= 200)) return res.status(400).json({ erro: 'limite tem de ser um inteiro entre 1 e 200' });
    }

    if (!(await Auction.exists({ _id: req.params.id }))) {
      return res.status(404).json({ erro: 'Leilão não encontrado' });
    }
    const lista = await Bid.find({ leilao: req.params.id }).sort({ valor: -1 }).limit(n).lean();
    res.json(lista.map(licitacao));
  } catch (err) { next(err); }
});

module.exports = router;
