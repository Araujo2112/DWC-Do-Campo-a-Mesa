// Encomenda: as LINHAS são embebidas (lidas sempre com a encomenda);
// comprador e produtor são REFERENCIADOS.
const { Schema, model, Types } = require('mongoose');

const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];

const orderSchema = new Schema({
  comprador: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  linhas: [{
    produto: { type: Types.ObjectId, ref: 'Product' },
    nome: String,      // cópia do nome no momento da compra
    precoUnit: Number, // cópia do preço no momento da compra
    quantidade: { type: Number, min: 1 }
  }],
  total: { type: Number, required: true, min: 0 }, // calculado no servidor
  estado: { type: String, enum: ESTADOS, default: 'pendente' },
  entrega: {
    tipo: { type: String, enum: ['levantamento', 'entrega'], default: 'levantamento' },
    morada: String
  },
  origem: { type: String, enum: ['carrinho', 'leilao'], default: 'carrinho' },
  // Índice único (só para quem tem o campo): um leilão gera no máximo UMA encomenda,
  // mesmo que o ciclo de fecho corra duas vezes ou em duas instâncias.
  leilao: { type: Types.ObjectId, ref: 'Auction', unique: true, sparse: true }
}, { timestamps: true });

orderSchema.statics.ESTADOS = ESTADOS;

module.exports = model('Order', orderSchema);
