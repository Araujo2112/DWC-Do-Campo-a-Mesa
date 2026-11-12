const Notificacao = require('../models/Notificacao');
const User = require('../models/User');

const codigo = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

const publica = (n) => ({
  id: String(n._id),
  tipo: n.tipo,
  texto: n.texto,
  link: n.link ?? null,
  lida: n.lida,
  criadoEm: n.createdAt,
});

// Grava e envia em tempo real. Nunca falha: uma notificação perdida não pode estragar a operação que a originou.
async function notificar(io, utilizador, { tipo, texto, link }) {
  try {
    const n = await Notificacao.create({ utilizador, tipo, texto, link });
    io?.to(`user:${utilizador}`).emit('notificacao', publica(n));
  } catch (err) {
    console.error('Notificação:', err);
  }
}

async function notificarAdmins(io, dados) {
  try {
    const ids = await User.distinct('_id', { papel: 'admin' });
    await Promise.all(ids.map((id) => notificar(io, id, dados)));
  } catch (err) {
    console.error('Notificação aos administradores:', err);
  }
}

module.exports = { notificar, notificarAdmins, publica, codigo, euro };
