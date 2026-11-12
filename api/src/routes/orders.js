// Encomendas
const router = require('express').Router();
const { isObjectIdOrHexString } = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const produtorValidado = require('../middleware/produtorValidado');
const idValido = require('../middleware/idValido');

const MAX_LINHAS = 50;
const MAX_QUANTIDADE = 1000;

const texto = (v) => typeof v === 'string' && v.trim() !== '';
const arredondar = (v) => Math.round(v * 100) / 100;

// Referência a um utilizador: { id, nome } se vier populado, só { id } se não.
const ref = (u) => (u && u.nome !== undefined ? { id: u._id, nome: u.nome } : { id: u });

// Formato único da encomenda que a API devolve (recebe um objeto simples, não um documento Mongoose).
const publica = (o) => ({
  id: o._id,
  comprador: ref(o.comprador),
  produtor: ref(o.produtor),
  linhas: o.linhas.map((l) => ({
    produto: l.produto,
    nome: l.nome,
    precoUnit: l.precoUnit,
    quantidade: l.quantidade,
  })),
  total: o.total,
  estado: o.estado,
  entrega: o.entrega,
  criadoEm: o.createdAt,
  atualizadoEm: o.updatedAt,
});

// Cada papel só vê as suas encomendas (o admin vê todas).
const filtroDoPapel = (user) => {
  if (user.papel === 'comprador') return { comprador: user.id };
  if (user.papel === 'produtor') return { produtor: user.id };
  return {};
};

// Desfaz o que já foi feito (stock descontado e encomendas criadas) se algo falhar a meio.
// O splice esvazia as listas: chamar duas vezes não devolve o stock duas vezes.
async function desfazer(baixados, criadas) {
  const itens = baixados.splice(0);
  const ids = criadas.splice(0).map((o) => o._id);
  await Promise.allSettled([
    ids.length ? Order.deleteMany({ _id: { $in: ids } }) : null,
    ...itens.map((b) => Product.updateOne({ _id: b.id }, { $inc: { stock: b.quantidade } })),
  ]);
}

// POST /api/orders  (comprador)  -> 201 [encomendas, uma por produtor] | 400 | 409
// Corpo: { linhas: [{ produto, quantidade }], entrega: { tipo, morada } }
router.post('/', auth('comprador'), async (req, res, next) => {
  const baixados = []; // [{ id, quantidade }] stock já descontado
  const criadas = [];  // encomendas já gravadas
  try {
    const { linhas, entrega } = req.body || {};

    // ---- validação (nada toca na base de dados antes de tudo estar válido) ----
    if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > MAX_LINHAS) {
      return res.status(400).json({ erro: `linhas tem de ter entre 1 e ${MAX_LINHAS} elementos` });
    }

    const pedido = new Map(); // id do produto -> quantidade (junta linhas repetidas)
    for (const l of linhas) {
      if (!l || typeof l.produto !== 'string' || !isObjectIdOrHexString(l.produto)) {
        return res.status(400).json({ erro: 'Cada linha precisa de um produto válido' });
      }
      if (!Number.isInteger(l.quantidade) || l.quantidade < 1 || l.quantidade > MAX_QUANTIDADE) {
        return res.status(400).json({ erro: `quantidade tem de ser um inteiro entre 1 e ${MAX_QUANTIDADE}` });
      }
      pedido.set(l.produto, (pedido.get(l.produto) || 0) + l.quantidade);
    }

    if (entrega !== undefined && (typeof entrega !== 'object' || entrega === null || Array.isArray(entrega))) {
      return res.status(400).json({ erro: 'entrega inválida' });
    }
    const tipo = entrega?.tipo ?? 'levantamento';
    if (!['levantamento', 'entrega'].includes(tipo)) {
      return res.status(400).json({ erro: 'entrega.tipo tem de ser "levantamento" ou "entrega"' });
    }
    if (tipo === 'entrega' && (!texto(entrega.morada) || entrega.morada.trim().length > 200)) {
      return res.status(400).json({ erro: 'entrega.morada é obrigatória (máximo 200 caracteres) para entregas' });
    }

    // ---- produtos: nome e preço vêm SEMPRE da base de dados ----
    const produtos = await Product.find({ _id: { $in: [...pedido.keys()] } }).lean();
    if (produtos.length !== pedido.size) {
      return res.status(400).json({ erro: 'Algum dos produtos já não existe' });
    }

    // ---- stock: descontado de forma atómica, produto a produto ----
    // O filtro "stock >= quantidade" e o $inc fazem-se numa só operação: dois pedidos
    // simultâneos nunca levam o stock abaixo de zero.
    for (const p of produtos) {
      const quantidade = pedido.get(String(p._id));
      const r = await Product.findOneAndUpdate(
        { _id: p._id, stock: { $gte: quantidade } },
        { $inc: { stock: -quantidade } }
      );
      if (!r) {
        await desfazer(baixados, criadas);
        return res.status(409).json({ erro: `Stock insuficiente para "${p.nome}"` });
      }
      baixados.push({ id: p._id, quantidade });
    }

    // ---- uma encomenda por produtor ----
    const grupos = new Map();
    for (const p of produtos) {
      const chave = String(p.produtor);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push({
        produto: p._id,
        nome: p.nome,
        precoUnit: p.preco,
        quantidade: pedido.get(String(p._id)),
      });
    }

    for (const [produtor, ls] of grupos) {
      const total = arredondar(ls.reduce((soma, l) => soma + l.precoUnit * l.quantidade, 0));
      const o = await Order.create({
        comprador: req.user.id,
        produtor,
        linhas: ls,
        total,
        entrega: tipo === 'entrega' ? { tipo, morada: entrega.morada.trim() } : { tipo },
      });
      criadas.push(o);
    }

    const resposta = criadas.map((o) => publica(o.toObject()));
    const io = req.app.get('io');
    for (const o of resposta) io?.to(`user:${o.produtor.id}`).emit('encomenda-nova', { id: o.id, total: o.total });
    if (resposta.length === 1) res.location(`/api/orders/${resposta[0].id}`);
    res.status(201).json(resposta);
  } catch (err) {
    await desfazer(baixados, criadas);
    next(err);
  }
});

// GET /api/orders  -> 200 [as encomendas do utilizador] (mais recentes primeiro, máx. 100)
router.get('/', auth(), async (req, res, next) => {
  try {
    const lista = await Order.find(filtroDoPapel(req.user))
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('comprador', 'nome')
      .populate('produtor', 'nome')
      .lean();
    res.json(lista.map(publica));
  } catch (err) { next(err); }
});

// GET /api/orders/:id  -> 200 | 400 | 404 (também 404 se a encomenda for de outra pessoa)
router.get('/:id', auth(), idValido(), async (req, res, next) => {
  try {
    const o = await Order.findOne({ _id: req.params.id, ...filtroDoPapel(req.user) })
      .populate('comprador', 'nome')
      .populate('produtor', 'nome')
      .lean();
    if (!o) return res.status(404).json({ erro: 'Encomenda não encontrada' });
    res.json(publica(o));
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id/estado  { estado }  (produtor dono)  -> 200 | 400 | 404 | 409
// O estado só avança um passo de cada vez: pendente -> confirmada -> pronta -> entregue.
router.patch('/:id/estado', auth('produtor'), produtorValidado, idValido(), async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    const novo = typeof estado === 'string' ? Order.ESTADOS.indexOf(estado) : -1;
    if (novo === -1) {
      return res.status(400).json({ erro: `estado tem de ser um de: ${Order.ESTADOS.join(', ')}` });
    }

    const meu = { _id: req.params.id, produtor: req.user.id };
    const atual = await Order.findOne(meu).select('estado').lean();
    if (!atual) return res.status(404).json({ erro: 'Encomenda não encontrada' });

    if (Order.ESTADOS.indexOf(atual.estado) + 1 !== novo) {
      return res.status(409).json({ erro: `Não é possível passar de "${atual.estado}" para "${estado}"` });
    }

    // O filtro inclui o estado lido: se alguém o mudou entretanto, não grava (409).
    const o = await Order.findOneAndUpdate(
      { ...meu, estado: atual.estado },
      { estado },
      { new: true, runValidators: true }
    ).lean();
    if (!o) return res.status(409).json({ erro: 'A encomenda foi alterada entretanto; tenta de novo' });

    // Notifica o comprador em tempo real (o frontend passa a ouvir no Passo 7).
    req.app.get('io')?.to(`user:${o.comprador}`).emit('encomenda-atualizada', { id: o._id, estado: o.estado });

    res.json(publica(o));
  } catch (err) { next(err); }
});

module.exports = router;