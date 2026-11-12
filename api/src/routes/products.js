// Passo 3: recurso /api/products
const router = require('express').Router();
const multer = require('multer');
const { isObjectIdOrHexString } = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const produtorValidado = require('../middleware/produtorValidado');
const idValido = require('../middleware/idValido');
const porFazer = require('./_naoImplementado');
const { mediasDosProdutos } = require('../services/avaliacoes');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const texto = (v) => typeof v === 'string' && v.trim() !== '';

// Escapa os caracteres especiais de regex: "q=(" ou "q=.*" são texto literal, não padrões.
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PRODUTOR_VALIDADO = { papel: 'produtor', 'produtor.validado': true };

const ORDENACOES = {
  recentes: { createdAt: -1 },
  nome: { nome: 1 },
  preco_asc: { preco: 1 },
  preco_desc: { preco: -1 },
};

// Valida o corpo de POST e PUT. Só devolve os campos permitidos (nunca "produtor" nem "imagemUrl"),
// por isso quem cria ou edita não escolhe o dono do produto.
function lerProduto(corpo) {
  const { nome, categoria, preco, unidade, stock, biologico, epocas } = corpo || {};

  if (!texto(nome) || nome.trim().length > 100) {
    return { erro: 'nome é obrigatório (máximo 100 caracteres)' };
  }
  if (!Product.CATEGORIAS.includes(categoria)) {
    return { erro: `categoria tem de ser uma de: ${Product.CATEGORIAS.join(', ')}` };
  }
  if (typeof preco !== 'number' || !Number.isFinite(preco) || preco < 0 || preco > 100000) {
    return { erro: 'preco tem de ser um número entre 0 e 100000' };
  }
  if (unidade !== undefined && (!texto(unidade) || unidade.trim().length > 30)) {
    return { erro: 'unidade tem de ser texto (máximo 30 caracteres)' };
  }
  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
    return { erro: 'stock tem de ser um inteiro ≥ 0' };
  }
  if (biologico !== undefined && typeof biologico !== 'boolean') {
    return { erro: 'biologico tem de ser true ou false' };
  }
  if (epocas !== undefined && (!Array.isArray(epocas) || !epocas.every((e) => Product.EPOCAS.includes(e)))) {
    return { erro: `epocas tem de ser uma lista de: ${Product.EPOCAS.join(', ')}` };
  }

  return {
    dados: {
      nome: nome.trim(),
      categoria,
      preco,
      unidade: unidade === undefined ? 'kg' : unidade.trim(),
      stock: stock ?? 0,
      biologico: biologico ?? false,
      epocas: [...new Set(epocas ?? [])],
    },
  };
}

// GET /api/products?q=&categoria=&precoMin=&precoMax=&bio=&epoca=&produtor=&ordenar=  -> 200 [produtos] | 400
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria, precoMin, precoMax, bio, epoca, produtor, localidade, ordenar } = req.query;

    // Cada parâmetro tem de ser texto: "?categoria[$ne]=x" chega aqui como objeto (injeção NoSQL).
    for (const v of [q, categoria, precoMin, precoMax, bio, epoca, produtor, localidade, ordenar]) {
      if (v !== undefined && typeof v !== 'string') {
        return res.status(400).json({ erro: 'Parâmetros de pesquisa inválidos' });
      }
    }

    const filtro = {};
    if (categoria && categoria !== 'Todos') filtro.categoria = categoria;

    const preco = {};
    if (precoMin) {
      const min = Number(precoMin);
      if (!Number.isFinite(min)) return res.status(400).json({ erro: 'precoMin tem de ser um número' });
      preco.$gte = min;
    }
    if (precoMax) {
      const max = Number(precoMax);
      if (!Number.isFinite(max)) return res.status(400).json({ erro: 'precoMax tem de ser um número' });
      preco.$lte = max;
    }
    if (Object.keys(preco).length) filtro.preco = preco;

    if (bio === 'true') filtro.biologico = true;

    if (epoca) {
      if (!Product.EPOCAS.includes(epoca)) return res.status(400).json({ erro: 'epoca inválida' });
      filtro.epocas = epoca;
    }
    // Condições sobre o produtor juntam-se com $and: o produto tem de cumprir todas.
    const condicoes = [];
    if (produtor) {
      if (!isObjectIdOrHexString(produtor)) return res.status(400).json({ erro: 'produtor inválido' });
      condicoes.push({ produtor });
    }
    if (localidade) {
      const ids = await User.distinct('_id', {
        ...PRODUTOR_VALIDADO,
        'produtor.localidade': { $regex: escaparRegex(localidade), $options: 'i' },
      });
      condicoes.push({ produtor: { $in: ids } });
    }
    if (q) {
      const padrao = { $regex: escaparRegex(q), $options: 'i' };
      // "q" procura no nome do produto e no nome do produtor (da conta e da exploração)
      const ids = await User.distinct('_id', {
        ...PRODUTOR_VALIDADO,
        $or: [{ nome: padrao }, { 'produtor.nomeExploracao': padrao }],
      });
      condicoes.push({ $or: [{ nome: padrao }, { produtor: { $in: ids } }] });
    }
    if (condicoes.length) filtro.$and = condicoes;
    if (ordenar && !ORDENACOES[ordenar]) {
      return res.status(400).json({ erro: `ordenar tem de ser um de: ${Object.keys(ORDENACOES).join(', ')}` });
    }

    const lista = await Product.find(filtro)
      .sort(ORDENACOES[ordenar || 'recentes'])
      .populate('produtor', 'nome produtor.localidade');
    const media = await mediasDosProdutos(lista.map((p) => p._id));
    res.json(lista.map((p) => ({ ...p.toObject(), ...media(p._id) })));
  } catch (err) { next(err); }
});

// GET /api/products/:id  -> 200 | 400 | 404
router.get('/:id', idValido(), async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id).populate('produtor', 'nome produtor.localidade');
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    const media = await mediasDosProdutos([p._id]);
    res.json({ ...p.toObject(), ...media(p._id) });
  } catch (err) { next(err); }
});

// POST /api/products  (produtor validado)  -> 201 + Location | 400 | 401 | 403
router.post('/', auth('produtor'), produtorValidado, async (req, res, next) => {
  try {
    const { erro, dados } = lerProduto(req.body);
    if (erro) return res.status(400).json({ erro });

    // O dono vem sempre do token, nunca do corpo do pedido.
    const p = await Product.create({ ...dados, produtor: req.user.id });
    res.status(201).location(`/api/products/${p._id}`).json(p);
  } catch (err) { next(err); }
});

// PUT /api/products/:id  (produtor dono)  -> 200 | 400 | 404
router.put('/:id', auth('produtor'), produtorValidado, idValido(), async (req, res, next) => {
  try {
    const { erro, dados } = lerProduto(req.body);
    if (erro) return res.status(400).json({ erro });

    // O filtro inclui o dono: o produto de outro produtor não é encontrado (404).
    const p = await Product.findOneAndUpdate(
      { _id: req.params.id, produtor: req.user.id },
      { $set: dados },
      { new: true, runValidators: true }
    );
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(p);
  } catch (err) { next(err); }
});

// DELETE /api/products/:id  (produtor dono)  -> 204 | 400 | 404
router.delete('/:id', auth('produtor'), produtorValidado, idValido(), async (req, res, next) => {
  try {
    const r = await Product.deleteOne({ _id: req.params.id, produtor: req.user.id });
    if (!r.deletedCount) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/products/:id/imagem  (multipart, campo "imagem")  -> 200 { imagemUrl }
// TODO (Passo 8): usar services/imagens.js para enviar req.file para o storage da Cloud
router.post('/:id/imagem', auth('produtor'), produtorValidado, upload.single('imagem'), porFazer('Upload da imagem do produto'));

module.exports = router;