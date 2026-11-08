// Passo 7: autenticação dos sockets com o mesmo JWT da API
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const registarLeiloes = require('./leiloes');
const { iniciarCiclo } = require('../services/cicloLeiloes');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('sem token');
      const { id } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      // O nome e o papel vêm da BD (e não do token): se o utilizador já não existe, a ligação é recusada.
      const u = await User.findById(id).select('nome papel').lean();
      if (!u) throw new Error('utilizador inexistente');
      socket.user = { id: String(u._id), nome: u.nome, papel: u.papel };
      next();
    } catch {
      next(new Error('não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    // Sala pessoal: permite notificar este utilizador (estado da encomenda, leilão ganho)
    socket.join(`user:${socket.user.id}`);
    registarLeiloes(io, socket);
  });

  iniciarCiclo(io); // começa e termina os leilões
};
