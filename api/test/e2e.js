// Testes de ponta a ponta da API (Passo 6: registo, login, JWT e papéis).
// Correm contra a API JÁ A CORRER, com o seed feito.
//
//   cd api
//   node --test test/e2e.js
//
// Outro URL (por exemplo, a API na Cloud):
//   $env:API_URL="https://a-minha-api.azurewebsites.net/api"; node --test test/e2e.js
//
// Cada teste cria os seus próprios utilizadores (emails únicos), por isso pode repetir-se.
// Os testes dos passos seguintes (produtos, encomendas, leilões) acrescentam-se neste ficheiro.

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const SEED = {
  comprador: 'tasca@exemplo.pt',
  produtor: 'horta@exemplo.pt',
  admin: 'admin@exemplo.pt',
  password: 'password123',
};
const unico = Date.now();
let contador = 0;
const emailNovo = (prefixo) => `${prefixo}.${unico}.${++contador}@teste.pt`;

// ---------- auxiliares ----------
async function pedir(metodo, caminho, { corpo, token } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta sem JSON */ }
  return { status: res.status, json };
}

const registar = (corpo) => pedir('POST', '/auth/registo', { corpo });
const login = (email, password = SEED.password) =>
  pedir('POST', '/auth/login', { corpo: { email, password } });

async function tokenDe(email) {
  const r = await login(email);
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return r.json.token;
}

function payloadJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

const compradorValido = (email) => ({ nome: 'Teste Comprador', email, password: 'segredo123' });

before(async () => {
  try {
    const r = await fetch(BASE + '/health');
    assert.equal(r.status, 200);
  } catch {
    throw new Error(`A API não responde em ${BASE}. Arranca-a com "npm run dev" (noutro terminal).`);
  }
});

// ---------- registo ----------
describe('POST /auth/registo', () => {
  it('cria um comprador: 201 com { id }', async () => {
    const r = await registar(compradorValido(emailNovo('comprador')));
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(typeof r.json.id, 'string');
  });

  it('não expõe a password nem o hash na resposta', async () => {
    const r = await registar(compradorValido(emailNovo('semhash')));
    const texto = JSON.stringify(r.json).toLowerCase();
    assert.ok(!texto.includes('password') && !texto.includes('hash'), `Resposta: ${texto}`);
  });

  it('email repetido: 409', async () => {
    const email = emailNovo('duplicado');
    assert.equal((await registar(compradorValido(email))).status, 201);
    assert.equal((await registar(compradorValido(email))).status, 409);
  });

  it('guarda o email em minúsculas', async () => {
    const maiusculas = emailNovo('Maiusculas').toUpperCase().replace('@TESTE.PT', '@teste.pt');
    assert.equal((await registar(compradorValido(maiusculas))).status, 201);
    assert.equal((await login(maiusculas.toLowerCase(), 'segredo123')).status, 200);
  });

  for (const [descricao, alterar] of [
    ['sem nome', (c) => { delete c.nome; }],
    ['sem email', (c) => { delete c.email; }],
    ['sem password', (c) => { delete c.password; }],
    ['email inválido', (c) => { c.email = 'isto-nao-e-um-email'; }],
    ['password com menos de 8 caracteres', (c) => { c.password = '1234567'; }],
    ['email que não é texto (objeto)', (c) => { c.email = { $ne: null }; }],
    ['password que não é texto (número)', (c) => { c.password = 12345678; }],
  ]) {
    it(`${descricao}: 400`, async () => {
      const corpo = compradorValido(emailNovo('invalido'));
      alterar(corpo);
      const r = await registar(corpo);
      assert.equal(r.status, 400, JSON.stringify(r.json));
    });
  }

  it('papel "admin" não pode ser pedido no registo: 400', async () => {
    const r = await registar({ ...compradorValido(emailNovo('admin')), papel: 'admin' });
    assert.equal(r.status, 400, 'Qualquer pessoa poderia fazer-se administrador!');
  });

  it('papel desconhecido: 400', async () => {
    const r = await registar({ ...compradorValido(emailNovo('papel')), papel: 'xpto' });
    assert.equal(r.status, 400);
  });

  it('produtor fica com validado=false, mesmo que envie validado=true', async () => {
    const email = emailNovo('produtor');
    const r = await registar({
      nome: 'Quinta de Teste',
      email,
      password: 'segredo123',
      papel: 'produtor',
      produtor: { nomeExploracao: 'Quinta de Teste', localidade: 'Viana do Castelo', validado: true },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const l = await login(email, 'segredo123');
    assert.equal(l.status, 200);
    assert.equal(l.json.utilizador.papel, 'produtor');
    assert.equal(l.json.utilizador.produtor?.validado, false,
      'Mass assignment: o produtor aprovou-se a si próprio (não uses ...req.body)');
  });
});

// ---------- login ----------
describe('POST /auth/login', () => {
  it('credenciais certas: 200 com token e utilizador (sem hash)', async () => {
    const r = await login(SEED.comprador);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(typeof r.json.token, 'string');
    assert.equal(r.json.utilizador.email, SEED.comprador);
    assert.equal(r.json.utilizador.papel, 'comprador');
    assert.ok(r.json.utilizador.id, 'o utilizador devia ter "id"');
    assert.ok(!JSON.stringify(r.json).toLowerCase().includes('passwordhash'), 'o hash não pode sair da API');
  });

  it('o JWT leva id e papel, tem expiração e não leva dados sensíveis', async () => {
    const token = await tokenDe(SEED.comprador);
    const p = payloadJwt(token);
    assert.ok(p.id, 'falta "id" no token');
    assert.equal(p.papel, 'comprador');
    assert.ok(p.exp && p.exp > Date.now() / 1000, 'o token tem de ter expiração (expiresIn)');
    assert.ok(!JSON.stringify(p).toLowerCase().includes('hash'));
  });

  it('password errada: 401', async () => {
    assert.equal((await login(SEED.comprador, 'errada-errada')).status, 401);
  });

  it('email inexistente: 401', async () => {
    assert.equal((await login('nao.existe@teste.pt')).status, 401);
  });

  it('a mensagem de erro é igual para "email inexistente" e "password errada"', async () => {
    const a = await login(SEED.comprador, 'errada-errada');
    const b = await login('nao.existe@teste.pt');
    assert.equal(a.json?.erro, b.json?.erro, 'Mensagens diferentes revelam que emails existem');
  });

  it('email como objeto ({"$ne": null}): 400 (injeção NoSQL)', async () => {
    const r = await pedir('POST', '/auth/login', { corpo: { email: { $ne: null }, password: SEED.password } });
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });

  it('sem corpo: 400', async () => {
    assert.equal((await pedir('POST', '/auth/login', { corpo: {} })).status, 400);
  });
});

// ---------- sessão ----------
describe('GET /auth/eu', () => {
  it('sem token: 401', async () => {
    assert.equal((await pedir('GET', '/auth/eu')).status, 401);
  });

  it('token inválido: 401', async () => {
    assert.equal((await pedir('GET', '/auth/eu', { token: 'abc.def.ghi' })).status, 401);
  });

  it('com token válido: 200 com o utilizador (mesmo formato do login, sem hash)', async () => {
    const token = await tokenDe(SEED.comprador);
    const r = await pedir('GET', '/auth/eu', { token });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.email, SEED.comprador);
    assert.ok(r.json.id, 'devolve "id" (como no login), não "_id"');
    assert.ok(!JSON.stringify(r.json).toLowerCase().includes('hash'));
  });
});

// ---------- controlo de acesso por papel ----------
describe('Controlo de acesso por papel (GET /admin/estatisticas)', () => {
  it('sem token: 401', async () => {
    assert.equal((await pedir('GET', '/admin/estatisticas')).status, 401);
  });

  it('comprador: 403', async () => {
    const token = await tokenDe(SEED.comprador);
    assert.equal((await pedir('GET', '/admin/estatisticas', { token })).status, 403);
  });

  it('produtor: 403', async () => {
    const token = await tokenDe(SEED.produtor);
    assert.equal((await pedir('GET', '/admin/estatisticas', { token })).status, 403);
  });

  it('admin: entra (nem 401 nem 403)', async () => {
    const token = await tokenDe(SEED.admin);
    const { status } = await pedir('GET', '/admin/estatisticas', { token });
    assert.ok(![401, 403].includes(status), `Recebeu ${status}`);
  });
});