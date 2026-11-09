// Avaliação: uma ao produtor e uma por cada produto da encomenda (coleção própria: cresce sem limite).
// A lista de quem denunciou fica EMBEBIDA: é pequena e lida sempre com a avaliação.
const { Schema, model, Types } = require('mongoose');

// ok -> denunciada (fila do admin) -> revista (admin manteve) | oculta (admin escondeu)
const MODERACAO = ['ok', 'denunciada', 'revista', 'oculta'];

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' }, // sem produto = avaliação ao produtor
  encomenda: { type: Types.ObjectId, ref: 'Order', required: true },
  classificacao: {
    type: Number, required: true, min: 1, max: 5,
    validate: { validator: Number.isInteger, message: 'classificacao tem de ser um inteiro' }
  },
  comentario: { type: String, trim: true, maxlength: 500 },
  denunciadoPor: [{ type: Types.ObjectId, ref: 'User' }],
  moderacao: { type: String, enum: MODERACAO, default: 'ok' }
}, { timestamps: true });

// Impede avaliar duas vezes o mesmo produto (ou o produtor, com produto em falta) na mesma encomenda.
reviewSchema.index({ encomenda: 1, produto: 1 }, { unique: true });
reviewSchema.index({ produtor: 1, produto: 1, createdAt: -1 });
reviewSchema.index({ moderacao: 1, createdAt: 1 });

reviewSchema.statics.MODERACAO = MODERACAO;

module.exports = model('Review', reviewSchema);
