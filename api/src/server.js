// Ponto de entrada: servidor HTTP partilhado pela API REST e pelo Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { ligarBD } = require('./config/db');
const registarSockets = require('./sockets');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  await ligarBD();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*' }
  });

  // Disponibiliza o io às rotas (ex.: notificar o comprador quando a encomenda muda)
  app.set('io', io);
  registarSockets(io);

  server.listen(PORT, () => {
    console.log(`API em http://localhost:${PORT}`);
    console.log(`Documentação em http://localhost:${PORT}/api-docs`);
  });
}

iniciar().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
