// Estado dos serviços Cloud, para o painel do administrador.
// Cada verificação tem limite de tempo e nunca lança: um serviço em baixo aparece como "erro", não derruba o pedido.
const mongoose = require('mongoose');
const { estadoStorage } = require('./imagens');

const LIMITE_MS = 3000;

function comLimite(promessa) {
  let t;
  const limite = new Promise((_, rejeitar) => {
    t = setTimeout(() => rejeitar(new Error('sem resposta em 3 s')), LIMITE_MS);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(t));
}

// O detalhe de um erro nunca vai para o cliente: pode conter hosts ou nomes de contas.
async function medir(id, nome, verificar) {
  const inicio = Date.now();
  try {
    const r = await comLimite(Promise.resolve().then(verificar));
    const item = { id, nome, estado: r.estado ?? 'ok', detalhe: r.detalhe };
    if (r.medirLatencia) item.latenciaMs = Date.now() - inicio;
    return item;
  } catch (err) {
    console.error(`Estado dos serviços (${id}):`, err.message);
    return { id, nome, estado: 'erro', detalhe: 'Sem resposta ou falha na verificação', latenciaMs: Date.now() - inicio };
  }
}

function duracao(segundos) {
  if (segundos < 3600) return `${Math.max(1, Math.floor(segundos / 60))} min`;
  if (segundos < 86400) return `${Math.floor(segundos / 3600)} h`;
  return `${Math.floor(segundos / 86400)} d`;
}

const verificarApi = () => ({
  detalhe: `${process.env.WEBSITE_SITE_NAME ? 'Azure App Service' : 'Execução local'} · Node ${process.version} · ativa há ${duracao(process.uptime())}`,
});

const verificarSocket = (app) => () => {
  const io = app.get('io');
  if (!io) throw new Error('Socket.io não iniciado');
  const n = io.engine?.clientsCount ?? io.sockets.sockets.size;
  return { detalhe: `${n} ${n === 1 ? 'ligação ativa' : 'ligações ativas'}` };
};

async function verificarMongo() {
  if (mongoose.connection.readyState !== 1) throw new Error('sem ligação');
  await mongoose.connection.db.admin().ping();
  const atlas = String(process.env.MONGODB_URI || '').startsWith('mongodb+srv://');
  return { detalhe: `${atlas ? 'Atlas' : 'MongoDB'} · base ${mongoose.connection.name}`, medirLatencia: true };
}

const verificarSwagger = (app) => () => {
  const doc = app.get('openapi');
  if (!doc?.paths) throw new Error('documento OpenAPI em falta');
  return { detalhe: `OpenAPI ${doc.info.version} · ${Object.keys(doc.paths).length} caminhos · /api-docs` };
};

async function verificarServicos(app) {
  return Promise.all([
    medir('api', 'API (App Service)', verificarApi),
    medir('socketio', 'Socket.io', verificarSocket(app)),
    medir('mongodb', 'MongoDB Atlas', verificarMongo),
    medir('blob', 'Blob Storage', estadoStorage),
    medir('swagger', 'Swagger UI', verificarSwagger(app)),
  ]);
}

module.exports = { verificarServicos };
