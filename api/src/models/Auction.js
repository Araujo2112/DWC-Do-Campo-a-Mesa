// Leilão em direto. As licitações ficam numa coleção própria (Bid): podem ser centenas.
const { Schema, model, Types } = require('mongoose');

const auctionSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  lote: { type: String, required: true },        // "200 kg de kiwi Hayward, calibre A"
  quantidade: String,
  precoBase: { type: Number, required: true, min: 0 },
  incremento: { type: Number, required: true, min: 0.01 },
  // Começa com valor = precoBase; a 1.ª licitação tem de ser >= precoBase + incremento
  licitacaoAtual: {
    valor: Number,
    comprador: { type: Types.ObjectId, ref: 'User' }
  },
  numLicitacoes: { type: Number, default: 0 }, // incrementado na MESMA operação atómica da licitação
  iniciaEm: { type: Date, required: true },
  terminaEm: { type: Date, required: true },
  estado: { type: String, enum: ['agendado', 'ativo', 'terminado'], default: 'agendado' },
  encomendaCriada: { type: Boolean, default: false } // a encomenda do vencedor já foi criada
}, { timestamps: true });

// Usado pelo ciclo de vida (começar/terminar) e pelas listagens por estado
auctionSchema.index({ estado: 1, terminaEm: 1 });

module.exports = model('Auction', auctionSchema);
