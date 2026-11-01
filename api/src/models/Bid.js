const { Schema, model, Types } = require('mongoose');

const bidSchema = new Schema({
  leilao: { type: Types.ObjectId, ref: 'Auction', required: true, index: true },
  comprador: { type: Types.ObjectId, ref: 'User', required: true },
  valor: { type: Number, required: true }
}, { timestamps: true });

module.exports = model('Bid', bidSchema);
