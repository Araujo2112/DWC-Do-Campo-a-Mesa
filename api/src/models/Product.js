const { Schema, model, Types } = require('mongoose');

const CATEGORIAS = ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];

const productSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  nome: { type: String, required: true, trim: true },
  categoria: { type: String, enum: CATEGORIAS, required: true },
  preco: { type: Number, required: true, min: 0 },
  unidade: { type: String, default: 'kg' }, // kg, unid., garrafa, 500 g…
  stock: { type: Number, default: 0, min: 0 },
  biologico: { type: Boolean, default: false },
  epocas: [{ type: String, enum: EPOCAS }],
  imagemUrl: String // Passo 8: URL da imagem no storage da Cloud
  // TODO (Passo 4): avaliação média?
}, { timestamps: true });

// Listas partilhadas com as rotas (validação do corpo e dos filtros)
productSchema.statics.CATEGORIAS = CATEGORIAS;
productSchema.statics.EPOCAS = EPOCAS;

module.exports = model('Product', productSchema);