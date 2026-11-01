const { Schema, model, Types } = require('mongoose');

const productSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true },
  categoria: {
    type: String,
    enum: ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'],
    required: true
  },
  preco: { type: Number, required: true, min: 0 },
  unidade: { type: String, default: 'kg' }, // kg, unid., garrafa, 500 g…
  stock: { type: Number, default: 0, min: 0 },
  biologico: { type: Boolean, default: false },
  epocas: [{ type: String, enum: ['Primavera', 'Verão', 'Outono', 'Inverno'] }],
  imagemUrl: String // Passo 8: URL da imagem no storage da Cloud
  // TODO (Passo 4): avaliação média? índices para pesquisa?
}, { timestamps: true });

// TODO (Passo 4): criar índices adequados às pesquisas, p. ex.:
// productSchema.index({ nome: 'text' });

module.exports = model('Product', productSchema);
