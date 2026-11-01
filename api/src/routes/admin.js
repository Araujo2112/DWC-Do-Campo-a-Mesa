// Painel do administrador
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

router.use(auth('admin'));

// GET /api/admin/estatisticas  -> 200 { utilizadores, produtores, encomendasHoje, leiloesAtivos }
router.get('/estatisticas', porFazer('Estatísticas globais'));

// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]
router.get('/produtores/pendentes', porFazer('Produtores por validar'));

// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200
router.patch('/produtores/:id/validacao', porFazer('Aprovar ou rejeitar produtor'));

// GET /api/admin/reviews/denunciadas  -> 200
router.get('/reviews/denunciadas', porFazer('Avaliações denunciadas'));

// PATCH /api/admin/reviews/:id  { visivel: false }  -> 200
router.patch('/reviews/:id', porFazer('Moderar avaliação'));

module.exports = router;
