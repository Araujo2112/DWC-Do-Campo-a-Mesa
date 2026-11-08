// Passo 7: leilões em tempo real
// Eventos do cliente:   'entrar' (leilaoId), 'sair' (leilaoId), 'licitar' ({ leilaoId, valor })
// Eventos do servidor:  'estado' ({ leilao, licitacoes, agora }), 'presenca' (n.º), 'nova-licitacao',
//                       'terminado', 'recusada' (mensagem)
const { isObjectIdOrHexString } = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const { montarEstado } = require('../services/leiloes');

const sala = (id) => `leilao:${id}`;
const MAX_SALAS = 10;
const VALOR_MAXIMO = 1_000_000;
const INTERVALO_MINIMO_MS = 250; // entre duas licitações do mesmo socket

const idValido = (v) => typeof v === 'string' && isObjectIdOrHexString(v);

// Participantes distintos (o mesmo utilizador com dois separadores conta uma vez)
async function emitirPresenca(io, leilaoId) {
  const sockets = await io.in(sala(leilaoId)).fetchSockets();
  io.to(sala(leilaoId)).emit('presenca', new Set(sockets.map((s) => s.user.id)).size);
}

// Porquê a licitação foi recusada (só para mensagem; quem decide é a operação atómica)
async function motivoDaRecusa(leilaoId, userId) {
  const a = await Auction.findById(leilaoId).select('estado terminaEm licitacaoAtual incremento produtor').lean();
  if (!a) return 'Leilão não encontrado';
  if (a.estado === 'agendado') return 'O leilão ainda não começou';
  if (a.estado !== 'ativo' || a.terminaEm <= new Date()) return 'O leilão já terminou';
  if (String(a.produtor) === userId) return 'Não podes licitar no teu próprio leilão';
  if (String(a.licitacaoAtual?.comprador) === userId) return 'Já és o licitador mais alto';
  const minimo = Math.round((a.licitacaoAtual.valor + a.incremento) * 100) / 100;
  return `A licitação tem de ser de pelo menos ${minimo.toFixed(2)} €`;
}

module.exports = (io, socket) => {
  let ultimaLicitacao = 0;
  const recusar = (mensagem) => socket.emit('recusada', mensagem);

  // Um erro dentro de um handler não pode derrubar o processo: um evento malformado nunca mata a API.
  const seguro = (nome, fn) => async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`Socket "${nome}":`, err);
      recusar('Erro interno');
    }
  };

  socket.on('entrar', seguro('entrar', async (leilaoId) => {
    if (!idValido(leilaoId)) return recusar('Leilão inválido');

    if (!socket.rooms.has(sala(leilaoId))) {
      const abertas = [...socket.rooms].filter((s) => s.startsWith('leilao:')).length;
      if (abertas >= MAX_SALAS) return recusar('Demasiadas salas abertas');
    }

    const estado = await montarEstado(leilaoId);
    if (!estado) return recusar('Leilão não encontrado');

    socket.join(sala(leilaoId));
    socket.emit('estado', estado);
    await emitirPresenca(io, leilaoId);
  }));

  socket.on('sair', seguro('sair', async (leilaoId) => {
    if (!idValido(leilaoId)) return;
    socket.leave(sala(leilaoId));
    await emitirPresenca(io, leilaoId);
  }));

  // ---- O desafio central: licitação validada numa ÚNICA operação atómica ----
  socket.on('licitar', seguro('licitar', async (dados) => {
    const { leilaoId, valor: bruto } = dados && typeof dados === 'object' ? dados : {};

    if (!idValido(leilaoId)) return recusar('Leilão inválido');
    // A regra vive no servidor: o cliente só esconde o botão.
    if (socket.user.papel !== 'comprador') return recusar('Só os compradores podem licitar');
    if (typeof bruto !== 'number' || !Number.isFinite(bruto) || bruto <= 0 || bruto > VALOR_MAXIMO) {
      return recusar('Valor inválido');
    }
    const centimos = Math.round(bruto * 100);
    if (Math.abs(bruto * 100 - centimos) > 1e-6) return recusar('O valor só pode ter duas casas decimais');
    const valor = centimos / 100;

    const agora = Date.now();
    if (agora - ultimaLicitacao < INTERVALO_MINIMO_MS) return recusar('Demasiados pedidos seguidos');
    ultimaLicitacao = agora;

    // Só grava se, NESTE instante, o leilão ainda estiver ativo, não tiver terminado e o valor
    // for >= atual + incremento. Dois pedidos simultâneos: a base de dados serializa-os e o segundo
    // já encontra o valor novo, por isso é recusado. O $round evita erros de vírgula flutuante.
    const a = await Auction.findOneAndUpdate(
      {
        _id: leilaoId,
        estado: 'ativo',
        terminaEm: { $gt: new Date() },
        produtor: { $ne: socket.user.id },
        'licitacaoAtual.comprador': { $ne: socket.user.id }, // quem lidera não licita contra si próprio
        $expr: { $gte: [valor, { $round: [{ $add: ['$licitacaoAtual.valor', '$incremento'] }, 2] }] },
      },
      {
        $set: { 'licitacaoAtual.valor': valor, 'licitacaoAtual.comprador': socket.user.id },
        $inc: { numLicitacoes: 1 },
      },
      { new: true }
    ).lean();

    if (!a) return recusar(await motivoDaRecusa(leilaoId, socket.user.id));

    // Histórico. Se falhar, o valor do leilão está certo na mesma (é a fonte da verdade).
    let bid = null;
    try {
      bid = await Bid.create({ leilao: a._id, comprador: socket.user.id, nome: socket.user.nome, valor });
    } catch (err) {
      console.error('Histórico de licitações: falha a gravar', err);
    }

    io.to(sala(leilaoId)).emit('nova-licitacao', {
      leilaoId,
      id: bid ? String(bid._id) : null,
      valor,
      comprador: socket.user.id,
      nome: socket.user.nome,
      criadoEm: bid ? bid.createdAt : new Date(),
      numLicitacoes: a.numLicitacoes,
    });
  }));

  // Atualizar a presença quando o utilizador fecha a página
  socket.on('disconnecting', () => {
    const salas = [...socket.rooms].filter((s) => s.startsWith('leilao:'));
    setImmediate(() => {
      for (const s of salas) emitirPresenca(io, s.slice('leilao:'.length)).catch(() => {});
    });
  });
};
