const router = require('express').Router();
const Notificacao = require('../models/Notificacao');
const auth = require('../middleware/auth');
const { publica } = require('../services/notificacoes');

const LIMITE = 30;

router.use(auth());

// GET /api/notifications  -> 200 { naoLidas, itens } (as mais recentes primeiro)
router.get('/', async (req, res, next) => {
  try {
    const [itens, naoLidas] = await Promise.all([
      Notificacao.find({ utilizador: req.user.id }).sort({ createdAt: -1 }).limit(LIMITE).lean(),
      Notificacao.countDocuments({ utilizador: req.user.id, lida: false }),
    ]);
    res.json({ naoLidas, itens: itens.map(publica) });
  } catch (err) { next(err); }
});

// POST /api/notifications/lidas  -> 204
router.post('/lidas', async (req, res, next) => {
  try {
    await Notificacao.updateMany({ utilizador: req.user.id, lida: false }, { lida: true });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
