// Passo 3: recurso /api/products
const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/products?q=&categoria=&precoMax=&bio=&epoca=  -> 200 [produtos]
// Exemplo já implementado; completar com os restantes filtros (época, produtor, ordenação…)
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria, precoMax, bio } = req.query;
    const filtro = {};
    if (q) filtro.nome = { $regex: q, $options: 'i' };
    if (categoria && categoria !== 'Todos') filtro.categoria = categoria;
    if (precoMax) filtro.preco = { $lte: Number(precoMax) };
    if (bio === 'true') filtro.biologico = true;
    // TODO: filtro por época ($in), por produtor e ordenação
    const lista = await Product.find(filtro).populate('produtor', 'nome produtor.localidade');
    res.json(lista);
  } catch (err) { next(err); }
});

// GET /api/products/:id  -> 200 | 404
router.get('/:id', porFazer('Detalhe de um produto'));

// POST /api/products  (produtor)  -> 201 + Location
router.post('/', auth('produtor'), porFazer('Criar produto do produtor autenticado'));

// PUT /api/products/:id  (produtor dono)  -> 200 | 404
router.put('/:id', auth('produtor'), porFazer('Atualizar produto'));

// DELETE /api/products/:id  (produtor dono)  -> 204 | 404
router.delete('/:id', auth('produtor'), porFazer('Remover produto'));

// POST /api/products/:id/imagem  (multipart, campo "imagem")  -> 200 { imagemUrl }
// TODO (Passo 8): usar services/imagens.js para enviar req.file para o storage da Cloud
router.post('/:id/imagem', auth('produtor'), upload.single('imagem'), porFazer('Upload da imagem do produto'));

module.exports = router;
