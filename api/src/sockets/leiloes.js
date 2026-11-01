// Passo 7: leilões em tempo real
// Eventos do cliente:   'entrar' (leilaoId), 'sair' (leilaoId), 'licitar' ({ leilaoId, valor })
// Eventos do servidor:  'estado' (leilão), 'presenca' (n.º), 'nova-licitacao', 'recusada' (mensagem)
const Auction = require('../models/Auction'); // eslint-disable-line no-unused-vars
const Bid = require('../models/Bid'); // eslint-disable-line no-unused-vars

const sala = (leilaoId) => `leilao:${leilaoId}`;

function emitirPresenca(io, leilaoId) {
  const n = io.sockets.adapter.rooms.get(sala(leilaoId))?.size ?? 0;
  io.to(sala(leilaoId)).emit('presenca', n);
}

module.exports = (io, socket) => {
  socket.on('entrar', async (leilaoId) => {
    socket.join(sala(leilaoId));
    emitirPresenca(io, leilaoId);
    // TODO: enviar ao socket o estado atual do leilão ('estado'), incluindo terminaEm
  });

  socket.on('sair', (leilaoId) => {
    socket.leave(sala(leilaoId));
    emitirPresenca(io, leilaoId);
  });

  socket.on('licitar', async ({ leilaoId, valor }) => { // eslint-disable-line no-unused-vars
    // TODO (desafio central): validar e gravar a licitação numa ÚNICA operação atómica
    //   Auction.findOneAndUpdate(
    //     { _id, estado: 'ativo', terminaEm: { $gt: agora },
    //       $expr: { $gte: [valor, { $add: ['$licitacaoAtual.valor', '$incremento'] }] } },
    //     { licitacaoAtual: { valor, comprador: socket.user.id } }, { new: true })
    //   - se devolver null  -> socket.emit('recusada', '…')
    //   - senão             -> Bid.create(…) e io.to(sala).emit('nova-licitacao', …)
    socket.emit('recusada', 'Licitação ainda não implementada');
  });

  // Atualizar a presença quando o utilizador fecha a página
  socket.on('disconnecting', () => {
    for (const s of socket.rooms) {
      if (s.startsWith('leilao:')) {
        setImmediate(() => emitirPresenca(io, s.slice('leilao:'.length)));
      }
    }
  });

  // TODO: fechar os leilões expirados (estado 'terminado') e avisar a sala e o vencedor
};
