// Páginas públicas dos produtores
const router = require('express').Router();
const porFazer = require('./_naoImplementado');

// GET /api/producers?localidade=  -> 200 [produtores validados]
router.get('/', porFazer('Listar produtores validados'));

// GET /api/producers/:id  -> 200 { produtor, produtos, avaliacaoMedia }
router.get('/:id', porFazer('Página pública do produtor'));

module.exports = router;
