// Licitação aceite (histórico). O valor atual do leilão vive no próprio Auction.
const { Schema, model, Types } = require('mongoose');

const bidSchema = new Schema({
  leilao: { type: Types.ObjectId, ref: 'Auction', required: true },
  comprador: { type: Types.ObjectId, ref: 'User', required: true },
  nome: String, // cópia do nome do comprador no momento da licitação (evita um populate a cada broadcast)
  valor: { type: Number, required: true }
}, { timestamps: true });

// Histórico de um leilão, da licitação mais alta para a mais baixa
bidSchema.index({ leilao: 1, valor: -1 });

module.exports = model('Bid', bidSchema);
