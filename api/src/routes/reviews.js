// Avaliações: o comprador avalia o produtor e cada produto, depois de a encomenda ser entregue
const router = require('express').Router();
const { isObjectIdOrHexString, Types } = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { notificar } = require('../services/notificacoes');
const auth = require('../middleware/auth');
const idValido = require('../middleware/idValido');
const { VISIVEL } = require('../services/avaliacoes');

const MAX_COMENTARIO = 500;

const idTexto = (v) => typeof v === 'string' && isObjectIdOrHexString(v);

const publica = (r) => ({
  id: r._id,
  autor: { nome: r.autor?.nome ?? 'Utilizador removido' },
  produto: r.produto ?? null,
  classificacao: r.classificacao,
  comentario: r.comentario ?? '',
  criadoEm: r.createdAt,
});

const minha = (r) => ({
  id: r._id,
  encomenda: r.encomenda,
  produto: r.produto ?? null,
  classificacao: r.classificacao,
  comentario: r.comentario ?? '',
  criadoEm: r.createdAt,
});

// POST /api/reviews  { encomenda, produto?, classificacao, comentario? }  (comprador)
//   -> 201 + Location | 400 | 401 | 403 | 404 | 409
router.post('/', auth('comprador'), async (req, res, next) => {
  try {
    const { encomenda, produto, classificacao, comentario } = req.body || {};

    if (!idTexto(encomenda)) return res.status(400).json({ erro: 'encomenda inválida' });
    if (produto !== undefined && !idTexto(produto)) return res.status(400).json({ erro: 'produto inválido' });
    if (!Number.isInteger(classificacao) || classificacao < 1 || classificacao > 5) {
      return res.status(400).json({ erro: 'classificacao tem de ser um inteiro entre 1 e 5' });
    }
    if (comentario !== undefined && (typeof comentario !== 'string' || comentario.trim().length > MAX_COMENTARIO)) {
      return res.status(400).json({ erro: `comentario tem de ser texto (máximo ${MAX_COMENTARIO} caracteres)` });
    }

    // A encomenda vem da BD e tem de ser do comprador: a de outro responde 404, como no resto da API.
    const o = await Order.findOne({ _id: encomenda, comprador: req.user.id }).lean();
    if (!o) return res.status(404).json({ erro: 'Encomenda não encontrada' });
    if (o.estado !== 'entregue') {
      return res.status(409).json({ erro: 'Só podes avaliar depois de a encomenda ser entregue' });
    }

    if (produto) {
      const id = new Types.ObjectId(produto);
      if (!o.linhas.some((l) => l.produto && id.equals(l.produto))) {
        return res.status(400).json({ erro: 'O produto não faz parte desta encomenda' });
      }
    }

    const r = await Review.create({
      autor: req.user.id,
      produtor: o.produtor,
      encomenda: o._id,
      produto,
      classificacao,
      comentario: comentario?.trim() || undefined,
    });
    try {
      const [autor, avaliado] = await Promise.all([
        User.findById(req.user.id).select('nome').lean(),
        produto ? Product.findById(produto).select('nome').lean() : null,
      ]);
      await notificar(req.app.get('io'), o.produtor, {
        tipo: 'avaliacao',
        texto: `${autor?.nome ?? 'Um comprador'} avaliou ${avaliado ? `"${avaliado.nome}"` : 'a tua exploração'} com ${classificacao} ${classificacao === 1 ? 'estrela' : 'estrelas'}.`,
        link: `/produtores/${o.produtor}`,
      });
    } catch (err) {
      console.error('Notificação da avaliação:', err); // a avaliação já está gravada
    }
    res.status(201).location(`/api/reviews/${r._id}`).json(minha(r.toObject()));
  } catch (err) {
    // O índice único (encomenda + produto) trava a avaliação repetida, mesmo com dois pedidos em simultâneo.
    if (err.code === 11000) return res.status(409).json({ erro: 'Já avaliaste isto nesta encomenda' });
    next(err);
  }
});

// GET /api/reviews/minhas  (comprador)  -> 200 [as minhas avaliações]
router.get('/minhas', auth('comprador'), async (req, res, next) => {
  try {
    const lista = await Review.find({ autor: req.user.id }).sort({ createdAt: -1 }).limit(500).lean();
    res.json(lista.map(minha));
  } catch (err) { next(err); }
});

// GET /api/reviews?produtor=  ou  ?produto=  -> 200 [avaliações visíveis] | 400
router.get('/', async (req, res, next) => {
  try {
    const { produtor, produto } = req.query;
    for (const v of [produtor, produto]) {
      if (v !== undefined && !idTexto(v)) return res.status(400).json({ erro: 'Identificador inválido' });
    }
    if (!produtor === !produto) {
      return res.status(400).json({ erro: 'Indica produtor ou produto (só um deles)' });
    }

    // produto: null apanha as avaliações ao produtor, sem as dos produtos.
    const filtro = { ...VISIVEL, ...(produto ? { produto } : { produtor, produto: null }) };
    const lista = await Review.find(filtro)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('autor', 'nome')
      .lean();
    res.json(lista.map(publica));
  } catch (err) { next(err); }
});

// GET /api/reviews/:id  -> 200 | 400 | 404 (as ocultas respondem 404)
router.get('/:id', idValido(), async (req, res, next) => {
  try {
    const r = await Review.findOne({ _id: req.params.id, ...VISIVEL }).populate('autor', 'nome').lean();
    if (!r) return res.status(404).json({ erro: 'Avaliação não encontrada' });
    res.json(publica(r));
  } catch (err) { next(err); }
});

// POST /api/reviews/:id/denuncia  (utilizador autenticado)  -> 204 | 400 | 401 | 403 | 404 | 409
router.post('/:id/denuncia', auth(), idValido(), async (req, res, next) => {
  try {
    const r = await Review.findOne({ _id: req.params.id, ...VISIVEL }).select('autor').lean();
    if (!r) return res.status(404).json({ erro: 'Avaliação não encontrada' });
    if (String(r.autor) === req.user.id) {
      return res.status(403).json({ erro: 'Não podes denunciar a tua própria avaliação' });
    }

    // Uma só operação atómica: regista a denúncia (se este utilizador ainda não denunciou) e,
    // se a avaliação estava "ok", passa-a para a fila do admin. Se já foi revista, mantém o estado.
    const utilizador = new Types.ObjectId(req.user.id);
    const feita = await Review.findOneAndUpdate(
      { _id: req.params.id, ...VISIVEL, denunciadoPor: { $ne: utilizador } },
      [{
        $set: {
          denunciadoPor: { $concatArrays: [{ $ifNull: ['$denunciadoPor', []] }, [utilizador]] },
          moderacao: { $cond: [{ $eq: ['$moderacao', 'ok'] }, 'denunciada', '$moderacao'] },
        },
      }]
    ).lean();
    if (!feita) return res.status(409).json({ erro: 'Já denunciaste esta avaliação' });

    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
