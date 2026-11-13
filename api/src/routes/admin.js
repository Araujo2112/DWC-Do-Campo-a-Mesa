// Painel do administrador
const router = require('express').Router();
const { isObjectIdOrHexString } = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');
const idValido = require('../middleware/idValido');
const { notificar } = require('../services/notificacoes');
const { verificarServicos } = require('../services/servicos');

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

// GET /api/admin/servicos  -> 200 { verificadoEm, servicos: [{ id, nome, estado: ok|aviso|erro, detalhe, latenciaMs? }] }
router.get('/servicos', async (req, res, next) => {
  try {
    const servicos = await verificarServicos(req.app);
    res.json({ verificadoEm: new Date().toISOString(), servicos });
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
    await notificar(req.app.get('io'), u._id, {
      tipo: 'conta',
      texto: aprovado
        ? 'A tua conta de produtor foi aprovada. Já podes publicar produtos e leilões.'
        : 'O registo da tua conta de produtor foi rejeitado.',
      link: '/produtor',
    });
    res.json(resumo(u));
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reviews/denunciadas  -> 200 [avaliações na fila de moderação]
router.get('/reviews/denunciadas', async (req, res, next) => {
  try {
    const lista = await Review.find({ moderacao: 'denunciada' })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('autor', 'nome')
      .populate('produtor', 'nome')
      .populate('produto', 'nome')
      .lean();

    res.json(lista.map((r) => ({
      id: r._id,
      classificacao: r.classificacao,
      comentario: r.comentario ?? '',
      autor: r.autor?.nome ?? 'Utilizador removido',
      produtor: r.produtor?.nome ?? null,
      produto: r.produto?.nome ?? null,
      numDenuncias: r.denunciadoPor.length,
      criadoEm: r.createdAt,
    })));
  } catch (err) { next(err); }
});

// PATCH /api/admin/reviews/:id  { acao: 'ocultar' | 'manter' }  -> 200 { id, moderacao } | 400 | 404 | 409
// ocultar: sai das listagens e da média. manter: fica "revista" e novas denúncias já não a põem na fila.
router.patch('/reviews/:id', idValido(), async (req, res, next) => {
  try {
    const { acao } = req.body || {};
    if (acao !== 'ocultar' && acao !== 'manter') {
      return res.status(400).json({ erro: 'acao tem de ser "ocultar" ou "manter"' });
    }

    const manter = acao === 'manter';
    const r = await Review.findOneAndUpdate(
      { _id: req.params.id, moderacao: manter ? 'denunciada' : { $ne: 'oculta' } },
      { moderacao: manter ? 'revista' : 'oculta' },
      { new: true }
    ).lean();

    if (!r) {
      const existe = await Review.exists({ _id: req.params.id });
      return existe
        ? res.status(409).json({ erro: 'A avaliação não está em estado de ser moderada assim' })
        : res.status(404).json({ erro: 'Avaliação não encontrada' });
    }
    res.json({ id: r._id, moderacao: r.moderacao });
  } catch (err) { next(err); }
});

module.exports = router;