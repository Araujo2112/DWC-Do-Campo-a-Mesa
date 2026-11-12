// Páginas públicas dos produtores (só produtores validados; nunca expõe o email)
const router = require('express').Router();
const { Types } = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const auth = require('../middleware/auth');
const idValido = require('../middleware/idValido');
const { VISIVEL, mediasDosProdutos, arredondar } = require('../services/avaliacoes');

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STOCK_BAIXO = 10;
const texto = (v) => typeof v === 'string' && v.trim() !== '';
const numeroEntre = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

const FILTRO_VALIDADOS = { papel: 'produtor', 'produtor.validado': true };

const publico = (u) => ({
  id: u._id,
  nome: u.nome,
  nomeExploracao: u.produtor?.nomeExploracao,
  descricao: u.produtor?.descricao,
  localidade: u.produtor?.localidade,
  localizacao: u.produtor?.localizacao,
});

// GET /api/producers?localidade=  -> 200 [produtores validados] | 400
router.get('/', async (req, res, next) => {
  try {
    const { localidade } = req.query;
    if (localidade !== undefined && typeof localidade !== 'string') {
      return res.status(400).json({ erro: 'Parâmetros de pesquisa inválidos' });
    }

    const filtro = { ...FILTRO_VALIDADOS };
    if (localidade) filtro['produtor.localidade'] = { $regex: escaparRegex(localidade), $options: 'i' };

    const lista = await User.find(filtro).sort({ nome: 1 }).lean();
    res.json(lista.map(publico));
  } catch (err) { next(err); }
});

// PATCH /api/producers/me  -> 200 perfil público | 400 | 401 | 403
// Só estes campos se alteram; "validado" e o resto do corpo são ignorados.
router.patch('/me', auth('produtor'), async (req, res, next) => {
  try {
    const { nomeExploracao, descricao, localidade, localizacao } = req.body || {};
    const $set = {};
    const $unset = {};

    if (nomeExploracao !== undefined) {
      if (!texto(nomeExploracao) || nomeExploracao.trim().length > 100) {
        return res.status(400).json({ erro: 'nomeExploracao tem de ser texto (máximo 100 caracteres)' });
      }
      $set['produtor.nomeExploracao'] = nomeExploracao.trim();
    }
    if (localidade !== undefined) {
      if (!texto(localidade) || localidade.trim().length > 100) {
        return res.status(400).json({ erro: 'localidade tem de ser texto (máximo 100 caracteres)' });
      }
      $set['produtor.localidade'] = localidade.trim();
    }
    if (descricao !== undefined) {
      if (typeof descricao !== 'string' || descricao.trim().length > 1000) {
        return res.status(400).json({ erro: 'descricao tem de ser texto (máximo 1000 caracteres)' });
      }
      $set['produtor.descricao'] = descricao.trim();
    }
    if (localizacao !== undefined) {
      if (localizacao === null) {
        $unset['produtor.localizacao'] = '';
      } else if (typeof localizacao === 'object' && numeroEntre(localizacao.lat, -90, 90) && numeroEntre(localizacao.lng, -180, 180)) {
        $set['produtor.localizacao'] = { lat: localizacao.lat, lng: localizacao.lng };
      } else {
        return res.status(400).json({ erro: 'localizacao tem de ser { lat (-90 a 90), lng (-180 a 180) } ou null' });
      }
    }

    const atualizacao = {};
    if (Object.keys($set).length) atualizacao.$set = $set;
    if (Object.keys($unset).length) atualizacao.$unset = $unset;
    if (!Object.keys(atualizacao).length) return res.status(400).json({ erro: 'Nada para alterar' });

    const u = await User.findOneAndUpdate({ _id: req.user.id, papel: 'produtor' }, atualizacao, { new: true }).lean();
    if (!u) return res.status(401).json({ erro: 'O utilizador já não existe' });
    res.json(publico(u));
  } catch (err) { next(err); }
});

// GET /api/producers/me/estatisticas  -> 200 | 401 | 403
router.get('/me/estatisticas', auth('produtor'), async (req, res, next) => {
  try {
    const id = new Types.ObjectId(req.user.id);
    const inicioDoMes = new Date();
    inicioDoMes.setDate(1);
    inicioDoMes.setHours(0, 0, 0, 0);

    const [vendas, encomendasPorTratar, produtos, avaliacao, leiloesAtivos] = await Promise.all([
      Order.aggregate([
        { $match: { produtor: id, createdAt: { $gte: inicioDoMes } } },
        { $group: { _id: null, total: { $sum: '$total' }, encomendas: { $sum: 1 } } },
      ]),
      Order.countDocuments({ produtor: id, estado: 'pendente' }),
      Product.aggregate([
        { $match: { produtor: id } },
        { $group: {
          _id: null,
          ativos: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
          stockBaixo: { $sum: { $cond: [{ $lte: ['$stock', STOCK_BAIXO] }, 1, 0] } },
        } },
      ]),
      Review.aggregate([
        { $match: { produtor: id, produto: null, ...VISIVEL } },
        { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
      ]),
      Auction.countDocuments({ produtor: id, estado: 'ativo', terminaEm: { $gt: new Date() } }),
    ]);

    res.json({
      vendasMes: Math.round((vendas[0]?.total ?? 0) * 100) / 100,
      encomendasMes: vendas[0]?.encomendas ?? 0,
      encomendasPorTratar,
      produtosAtivos: produtos[0]?.ativos ?? 0,
      produtosComStockBaixo: produtos[0]?.stockBaixo ?? 0,
      avaliacaoMedia: avaliacao[0] ? arredondar(avaliacao[0].media) : null,
      numAvaliacoes: avaliacao[0]?.total ?? 0,
      leiloesAtivos,
    });
  } catch (err) { next(err); }
});

// GET /api/producers/:id  -> 200 { produtor, produtos, avaliacaoMedia, numAvaliacoes } | 400 | 404
router.get('/:id', idValido(), async (req, res, next) => {
  try {
    const u = await User.findOne({ _id: req.params.id, ...FILTRO_VALIDADOS }).lean();
    if (!u) return res.status(404).json({ erro: 'Produtor não encontrado' });

    const [produtos, avaliacoes] = await Promise.all([
      Product.find({ produtor: u._id }).sort({ nome: 1 }).lean(),
      Review.aggregate([
        // produto: null = só as avaliações ao produtor (as dos produtos não entram nesta média)
        { $match: { produtor: u._id, produto: null, ...VISIVEL } },
        { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
      ]),
    ]);

    const media = await mediasDosProdutos(produtos.map((p) => p._id));
    const a = avaliacoes[0];
    res.json({
      produtor: publico(u),
      produtos: produtos.map((p) => ({ ...p, ...media(p._id) })),
      avaliacaoMedia: a ? arredondar(a.media) : null,
      numAvaliacoes: a ? a.total : 0,
    });
  } catch (err) { next(err); }
});

module.exports = router;