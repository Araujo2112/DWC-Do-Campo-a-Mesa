// Encomendas
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// POST /api/orders  (comprador)  -> 201
// TODO: copiar nome e preço de cada produto para as linhas e validar o stock
router.post('/', auth('comprador'), porFazer('Criar encomenda'));

// GET /api/orders  -> 200 [encomendas do utilizador: como comprador ou como produtor]
router.get('/', auth(), porFazer('Listar encomendas do utilizador'));

// GET /api/orders/:id  -> 200 | 404
router.get('/:id', auth(), porFazer('Detalhe da encomenda'));

// PATCH /api/orders/:id/estado  (produtor)  -> 200
// TODO (Passo 7): depois de gravar, notificar o comprador em tempo real:
//   req.app.get('io').to(`user:${encomenda.comprador}`)
//     .emit('encomenda-atualizada', { id: encomenda._id, estado: encomenda.estado });
router.patch('/:id/estado', auth('produtor'), porFazer('Mudar estado da encomenda'));

module.exports = router;
