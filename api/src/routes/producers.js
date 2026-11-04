// Páginas públicas dos produtores (só produtores validados; nunca expõe o email)
const router = require('express').Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const idValido = require('../middleware/idValido');

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// GET /api/producers/:id  -> 200 { produtor, produtos, avaliacaoMedia, numAvaliacoes } | 400 | 404
router.get('/:id', idValido(), async (req, res, next) => {
  try {
    const u = await User.findOne({ _id: req.params.id, ...FILTRO_VALIDADOS }).lean();
    if (!u) return res.status(404).json({ erro: 'Produtor não encontrado' });

    const [produtos, avaliacoes] = await Promise.all([
      Product.find({ produtor: u._id }).sort({ nome: 1 }).lean(),
      Review.aggregate([
        { $match: { produtor: u._id, visivel: true } },
        { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
      ]),
    ]);

    const a = avaliacoes[0];
    res.json({
      produtor: publico(u),
      produtos,
      avaliacaoMedia: a ? Math.round(a.media * 10) / 10 : null,
      numAvaliacoes: a ? a.total : 0,
    });
  } catch (err) { next(err); }
});

module.exports = router;