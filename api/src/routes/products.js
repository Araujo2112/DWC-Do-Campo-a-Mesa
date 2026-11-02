// Passo 3: recurso /api/products
const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const produtorValidado = require('../middleware/produtorValidado');
const porFazer = require('./_naoImplementado');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Escapa os caracteres especiais de regex: "q=(" ou "q=.*" são texto literal, não padrões.
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/products?q=&categoria=&precoMax=&bio=&epoca=  -> 200 [produtos] | 400
// Exemplo já implementado; completar com os restantes filtros (época, produtor, ordenação…)
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria, precoMax, bio } = req.query;

    // Cada parâmetro tem de ser texto: "?categoria[$ne]=x" chega aqui como objeto (injeção NoSQL).
    for (const v of [q, categoria, precoMax, bio]) {
      if (v !== undefined && typeof v !== 'string') {
        return res.status(400).json({ erro: 'Parâmetros de pesquisa inválidos' });
      }
    }

    const filtro = {};
    if (q) filtro.nome = { $regex: escaparRegex(q), $options: 'i' };
    if (categoria && categoria !== 'Todos') filtro.categoria = categoria;
    if (precoMax) {
      const max = Number(precoMax);
      if (!Number.isFinite(max)) return res.status(400).json({ erro: 'precoMax tem de ser um número' });
      filtro.preco = { $lte: max };
    }
    if (bio === 'true') filtro.biologico = true;
    // TODO: filtro por época ($in), por produtor e ordenação
    const lista = await Product.find(filtro).populate('produtor', 'nome produtor.localidade');
    res.json(lista);
  } catch (err) { next(err); }
});

// GET /api/products/:id  -> 200 | 404
router.get('/:id', porFazer('Detalhe de um produto'));

// POST /api/products  (produtor validado)  -> 201 + Location
router.post('/', auth('produtor'), produtorValidado, porFazer('Criar produto do produtor autenticado'));

// PUT /api/products/:id  (produtor dono)  -> 200 | 404
router.put('/:id', auth('produtor'), produtorValidado, porFazer('Atualizar produto'));

// DELETE /api/products/:id  (produtor dono)  -> 204 | 404
router.delete('/:id', auth('produtor'), produtorValidado, porFazer('Remover produto'));

// POST /api/products/:id/imagem  (multipart, campo "imagem")  -> 200 { imagemUrl }
// TODO (Passo 8): usar services/imagens.js para enviar req.file para o storage da Cloud
router.post('/:id/imagem', auth('produtor'), produtorValidado, upload.single('imagem'), porFazer('Upload da imagem do produto'));

module.exports = router;