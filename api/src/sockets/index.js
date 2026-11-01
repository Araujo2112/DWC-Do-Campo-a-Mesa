// Passo 7: autenticação dos sockets com o mesmo JWT da API
const jwt = require('jsonwebtoken');
const registarLeiloes = require('./leiloes');

module.exports = (io) => {
  io.use((socket, next) => {
    try {
      const { token } = socket.handshake.auth;
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    // Sala pessoal: permite notificar este utilizador (ex.: estado da encomenda)
    socket.join(`user:${socket.user.id}`);
    registarLeiloes(io, socket);
  });
};
