// Testes de ponta a ponta: estado dos serviços Cloud (painel do administrador)
//
//   cd api
//   npm test
//
// Correm contra a API JÁ A CORRER, com o seed feito. Nunca os apontes à base de produção.

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const SEED = { comprador: 'tasca@exemplo.pt', produtor: 'horta@exemplo.pt', admin: 'admin@exemplo.pt', password: 'password123' };

async function pedir(metodo, caminho, { token } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta sem JSON */ }
  return { status: res.status, json, texto };
}

async function entrar(email) {
  const res = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SEED.password }),
  });
  assert.equal(res.status, 200, `Login de ${email} falhou (${res.status}). Já fizeste "npm run seed"?`);
  return (await res.json()).token;
}

let admin, comprador, produtor;

before(async () => {
  try {
    assert.equal((await fetch(BASE + '/health')).status, 200);
  } catch {
    throw new Error(`A API não responde em ${BASE}. Arranca-a com "npm run dev" (noutro terminal).`);
  }
  [admin, comprador, produtor] = await Promise.all([entrar(SEED.admin), entrar(SEED.comprador), entrar(SEED.produtor)]);
});

describe('GET /admin/servicos', () => {
  it('401 sem token', async () => {
    assert.equal((await pedir('GET', '/admin/servicos')).status, 401);
  });

  it('403 para comprador e para produtor', async () => {
    assert.equal((await pedir('GET', '/admin/servicos', { token: comprador })).status, 403);
    assert.equal((await pedir('GET', '/admin/servicos', { token: produtor })).status, 403);
  });

  it('200 para o admin, com os 5 serviços pela ordem esperada', async () => {
    const r = await pedir('GET', '/admin/servicos', { token: admin });
    assert.equal(r.status, 200);
    assert.ok(!Number.isNaN(Date.parse(r.json.verificadoEm)));
    assert.deepEqual(r.json.servicos.map((s) => s.id), ['api', 'socketio', 'mongodb', 'blob', 'swagger']);
    for (const s of r.json.servicos) {
      assert.ok(['ok', 'aviso', 'erro'].includes(s.estado), `${s.id}: estado inválido`);
      assert.equal(typeof s.nome, 'string');
      assert.equal(typeof s.detalhe, 'string');
    }
  });

  it('API, Socket.io, MongoDB e Swagger estão ok; o MongoDB traz a latência', async () => {
    const { json } = await pedir('GET', '/admin/servicos', { token: admin });
    const por = Object.fromEntries(json.servicos.map((s) => [s.id, s]));
    for (const id of ['api', 'socketio', 'mongodb', 'swagger']) assert.equal(por[id].estado, 'ok', `${id}: ${por[id].detalhe}`);
    assert.equal(typeof por.mongodb.latenciaMs, 'number');
    assert.match(por.swagger.detalhe, /caminhos/);
  });

  it('o Blob Storage está ok (Azure) ou em aviso (disco local), nunca em erro', async () => {
    const { json } = await pedir('GET', '/admin/servicos', { token: admin });
    const blob = json.servicos.find((s) => s.id === 'blob');
    assert.ok(['ok', 'aviso'].includes(blob.estado), blob.detalhe);
  });

  it('não expõe segredos (URI do MongoDB, chaves de storage)', async () => {
    const r = await pedir('GET', '/admin/servicos', { token: admin });
    assert.doesNotMatch(r.texto, /mongodb(\+srv)?:\/\/|AccountKey|JWT_SECRET/i);
  });
});
