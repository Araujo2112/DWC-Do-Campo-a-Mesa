// Utilizador: comprador (particular ou restaurante), produtor ou administrador
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  papel: { type: String, enum: ['comprador', 'produtor', 'admin'], default: 'comprador' },

  // Dados específicos do produtor (página pública)
  produtor: {
    nomeExploracao: String,
    descricao: String,
    localidade: String,
    localizacao: { lat: Number, lng: Number },
    validado: { type: Boolean, default: false } // o administrador valida o registo
  }
  // TODO (Passo 4): favoritos? morada de entrega? tipo de comprador (particular/restaurante)?
}, { timestamps: true });

module.exports = model('User', userSchema);
