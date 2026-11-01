const mongoose = require('mongoose');

async function ligarBD() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não está definida (ver .env.example)');
  await mongoose.connect(uri);
  console.log('Ligado ao MongoDB');
}

module.exports = { ligarBD };
