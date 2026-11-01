const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// POST /api/reviews  (comprador, só após encomenda entregue)  -> 201
router.post('/', auth('comprador'), porFazer('Criar avaliação'));

// GET /api/reviews?produtor=&produto=  -> 200 [avaliações visíveis]
router.get('/', porFazer('Listar avaliações'));

// POST /api/reviews/:id/denuncia  -> 204
router.post('/:id/denuncia', auth(), porFazer('Denunciar avaliação'));

module.exports = router;
