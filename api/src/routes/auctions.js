// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// GET /api/auctions?estado=ativo  -> 200 [leilões]
router.get('/', porFazer('Listar leilões (ativos, agendados, terminados)'));

// GET /api/auctions/:id  -> 200 leilão + últimas licitações
router.get('/:id', porFazer('Detalhe do leilão'));

// POST /api/auctions  (produtor)  -> 201
// TODO: definir licitacaoAtual.valor = precoBase e terminaEm = iniciaEm + duração
router.post('/', auth('produtor'), porFazer('Criar leilão'));

// GET /api/auctions/:id/bids  -> 200 [licitações]
router.get('/:id/bids', porFazer('Histórico de licitações'));

module.exports = router;
