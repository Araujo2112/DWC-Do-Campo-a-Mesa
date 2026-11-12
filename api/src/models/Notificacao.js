const { Schema, model, Types } = require('mongoose');

const notificacaoSchema = new Schema({
  utilizador: { type: Types.ObjectId, ref: 'User', required: true },
  tipo: { type: String, required: true },
  texto: { type: String, required: true },
  link: String,
  lida: { type: Boolean, default: false },
}, { timestamps: true });

notificacaoSchema.index({ utilizador: 1, createdAt: -1 });

module.exports = model('Notificacao', notificacaoSchema, 'notificacoes');
