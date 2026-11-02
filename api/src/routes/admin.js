// Painel do administrador
const router = require('express').Router();
const { isObjectIdOrHexString } = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const porFazer = require('./_naoImplementado');

router.use(auth('admin'));

// Produtores que ainda aguardam decisão do administrador.
const FILTRO_PENDENTES = {
  papel: 'produtor',
  'produtor.validado': false,
  'produtor.rejeitado': { $ne: true },
};

const resumo = (u) => ({
  id: u._id,
  nome: u.nome,
  email: u.email,
  produtor: u.produtor,
  criadoEm: u.createdAt,
});

// GET /api/admin/estatisticas  -> 200 { utilizadores, produtores, produtoresPorValidar, encomendasHoje, leiloesAtivos }
router.get('/estatisticas', async (req, res, next) => {
  try {
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const [utilizadores, produtores, produtoresPorValidar, encomendasHoje, leiloesAtivos] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ papel: 'produtor', 'produtor.validado': true }),
      User.countDocuments(FILTRO_PENDENTES),
      Order.countDocuments({ createdAt: { $gte: inicioDoDia } }),
      Auction.countDocuments({ estado: 'ativo', terminaEm: { $gt: new Date() } }),
    ]);

    res.json({ utilizadores, produtores, produtoresPorValidar, encomendasHoje, leiloesAtivos });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]
router.get('/produtores/pendentes', async (req, res, next) => {
  try {
    const lista = await User.find(FILTRO_PENDENTES).sort({ createdAt: 1 }).lean();
    res.json(lista.map(resumo));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200
router.patch('/produtores/:id/validacao', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { aprovado } = req.body || {};

    if (!isObjectIdOrHexString(id)) return res.status(400).json({ erro: 'Id inválido' });
    // Tem de ser mesmo booleano: "false" (texto) seria truthy e aprovava o produtor.
    if (typeof aprovado !== 'boolean') {
      return res.status(400).json({ erro: 'aprovado tem de ser true ou false' });
    }

    const u = await User.findOneAndUpdate(
      { _id: id, papel: 'produtor' },
      { $set: { 'produtor.validado': aprovado, 'produtor.rejeitado': !aprovado } },
      { new: true }
    ).lean();

    if (!u) return res.status(404).json({ erro: 'Produtor não encontrado' });
    res.json(resumo(u));
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reviews/denunciadas  -> 200
router.get('/reviews/denunciadas', porFazer('Avaliações denunciadas'));

// PATCH /api/admin/reviews/:id  { visivel: false }  -> 200
router.patch('/reviews/:id', porFazer('Moderar avaliação'));

module.exports = router;