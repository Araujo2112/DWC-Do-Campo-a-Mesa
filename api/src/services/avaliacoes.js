const Review = require('../models/Review');

// Avaliações ocultas pelo admin não contam nas listagens nem nas médias.
const VISIVEL = { moderacao: { $ne: 'oculta' } };

const arredondar = (v) => Math.round(v * 10) / 10;

// Devolve uma função id -> { avaliacaoMedia, numAvaliacoes }, com uma só consulta para todos os produtos.
async function mediasDosProdutos(ids) {
  const grupos = await Review.aggregate([
    { $match: { produto: { $in: ids }, ...VISIVEL } },
    { $group: { _id: '$produto', media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
  ]);
  const porProduto = new Map(grupos.map((g) => [String(g._id), g]));

  return (id) => {
    const g = porProduto.get(String(id));
    return { avaliacaoMedia: g ? arredondar(g.media) : null, numAvaliacoes: g ? g.total : 0 };
  };
}

module.exports = { VISIVEL, mediasDosProdutos, arredondar };
