// Ciclo de vida dos leilões: agendado -> ativo -> terminado, e encomenda do vencedor.
// Corre ao arrancar e de 5 em 5 segundos. Todas as transições são atómicas
// (findOneAndUpdate com o estado no filtro), por isso é seguro correr em mais de uma instância.
const User = require('../models/User');
const Auction = require('../models/Auction');
const Order = require('../models/Order');
const { montarEstado } = require('./leiloes');

const INTERVALO_MS = Number(process.env.CICLO_LEILOES_MS) || 5000;
const sala = (id) => `leilao:${id}`;

// agendado -> ativo quando chega a hora de início
async function ativarAgendados(io) {
  const prontos = await Auction.find({ estado: 'agendado', iniciaEm: { $lte: new Date() } }).select('_id').lean();
  for (const { _id } of prontos) {
    const a = await Auction.findOneAndUpdate({ _id, estado: 'agendado' }, { estado: 'ativo' }, { new: true }).lean();
    if (!a) continue; // outra instância foi mais rápida
    const estado = await montarEstado(_id);
    if (estado) io.to(sala(_id)).emit('estado', estado); // quem já estava na sala passa a ver o leilão ativo
  }
}

// Cria a encomenda do vencedor. O índice único em Order.leilao torna isto idempotente.
async function criarEncomendaDoVencedor(a) {
  try {
    await Order.create({
      comprador: a.licitacaoAtual.comprador,
      produtor: a.produtor,
      linhas: [{ produto: a.produto, nome: a.lote, precoUnit: a.licitacaoAtual.valor, quantidade: 1 }],
      total: a.licitacaoAtual.valor,
      entrega: { tipo: 'levantamento' },
      origem: 'leilao',
      leilao: a._id,
    });
  } catch (err) {
    if (err.code !== 11000) throw err; // 11000 = já existe: tudo bem
  }
  await Auction.updateOne({ _id: a._id }, { encomendaCriada: true });
  return Order.findOne({ leilao: a._id }).select('_id').lean();
}

// ativo -> terminado quando passa terminaEm. Também recupera leilões já terminados
// cujo vencedor ficou sem encomenda (por exemplo, o servidor morreu a meio do fecho).
async function fecharExpirados(io) {
  const agora = new Date();
  const lista = await Auction.find({
    $or: [
      { estado: 'ativo', terminaEm: { $lte: agora } },
      { estado: 'terminado', 'licitacaoAtual.comprador': { $exists: true }, encomendaCriada: { $ne: true } },
    ],
  }).limit(50).lean();

  for (let a of lista) {
    try {
      let fechadoAgora = false;
      if (a.estado === 'ativo') {
        // O filtro repete as condições: se outra instância já fechou, devolve null.
        const r = await Auction.findOneAndUpdate(
          { _id: a._id, estado: 'ativo', terminaEm: { $lte: agora } },
          { estado: 'terminado' },
          { new: true }
        ).lean();
        if (!r) continue;
        a = r;
        fechadoAgora = true;
      }

      const comprador = a.licitacaoAtual?.comprador;
      const encomenda = comprador ? await criarEncomendaDoVencedor(a) : null;
      if (!fechadoAgora) continue;

      const vencedor = comprador ? await User.findById(comprador).select('nome').lean() : null;
      const resultado = {
        leilaoId: String(a._id),
        vencedor: vencedor ? { id: String(vencedor._id), nome: vencedor.nome } : null,
        valor: comprador ? a.licitacaoAtual.valor : null,
        numLicitacoes: a.numLicitacoes ?? 0,
      };
      io.to(sala(a._id)).emit('terminado', resultado);
      if (comprador) {
        io.to(`user:${comprador}`).emit('leilao-ganho', {
          leilaoId: String(a._id),
          lote: a.lote,
          valor: a.licitacaoAtual.valor,
          encomenda: encomenda ? String(encomenda._id) : null,
        });
      }
      io.to(`user:${a.produtor}`).emit('leilao-terminado', { ...resultado, lote: a.lote });
    } catch (err) {
      console.error(`Ciclo dos leilões: falha no leilão ${a._id}:`, err);
    }
  }
}

function iniciarCiclo(io) {
  let aCorrer = false;
  const passo = async () => {
    if (aCorrer) return; // um passo lento não se sobrepõe ao seguinte
    aCorrer = true;
    try {
      await ativarAgendados(io);
      await fecharExpirados(io);
    } catch (err) {
      console.error('Ciclo dos leilões:', err);
    } finally {
      aCorrer = false;
    }
  };
  passo();
  return setInterval(passo, INTERVALO_MS).unref();
}

module.exports = { iniciarCiclo };
