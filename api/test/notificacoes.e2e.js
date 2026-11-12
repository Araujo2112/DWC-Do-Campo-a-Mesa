// Testes de ponta a ponta: notificações (sino)
//
//   cd api
//   npm test
//
// Correm contra a API JÁ A CORRER, com o seed feito. Nunca os apontes à base de produção.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const URL_SOCKET = process.env.SOCKET_URL || BASE.replace(/\/api\/?$/, '');
const SEED = { comprador: 'tasca@exemplo.pt', produtor: 'horta@exemplo.pt', admin: 'admin@exemplo.pt', password: 'password123' };
const unico = Date.now();
let contador = 0;
const emailNovo = (prefixo) => `${prefixo}.${unico}.${++contador}@teste.pt`;

async function pedir(metodo, caminho, { corpo, token } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta sem JSON */ }
  return { status: res.status, json };
}

async function entrar(email, password = SEED.password) {
  const r = await pedir('POST', '/auth/login', { corpo: { email, password } });
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return { token: r.json.token, id: r.json.utilizador.id };
}

const sockets = [];
function ligar(token) {
  return new Promise((resolve, reject) => {
    const s = io(URL_SOCKET, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}
function esperar(s, evento, ms = 5000, filtro = () => true) {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => { s.off(evento, aoReceber); reject(new Error(`Tempo esgotado à espera de "${evento}"`)); }, ms);
    function aoReceber(dados) {
      if (!filtro(dados)) return;
      clearTimeout(temporizador);
      s.off(evento, aoReceber);
      resolve(dados);
    }
    s.on(evento, aoReceber);
  });
}

const lista = (token) => pedir('GET', '/notifications', { token });
let admin, tasca, horta;

before(async () => {
  try {
    assert.equal((await fetch(BASE + '/health')).status, 200);
  } catch {
    throw new Error(`A API não responde em ${BASE}. Arranca-a com "npm run dev" (noutro terminal).`);
  }
  admin = await entrar(SEED.admin);
  tasca = await entrar(SEED.comprador);
  horta = await entrar(SEED.produtor);
});

after(() => { for (const s of sockets) s.close(); });

describe('Notificações: acesso', () => {
  it('sem token: 401', async () => {
    assert.equal((await pedir('GET', '/notifications')).status, 401);
    assert.equal((await pedir('POST', '/notifications/lidas')).status, 401);
  });

  it('GET devolve { naoLidas, itens }', async () => {
    const r = await lista(tasca.token);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(typeof r.json.naoLidas, 'number');
    assert.ok(Array.isArray(r.json.itens));
  });
});

describe('Notificações: quem recebe o quê', () => {
  it('registo de produtor avisa os administradores (em tempo real e na lista)', async () => {
    const sAdmin = await ligar(admin.token);
    const nome = `Quinta Aviso ${unico}`;
    const espera = esperar(sAdmin, 'notificacao', 5000, (n) => n.texto.includes(nome));
    const r = await pedir('POST', '/auth/registo', {
      corpo: { nome, email: emailNovo('novo'), password: 'segredo123', papel: 'produtor', produtor: { nomeExploracao: nome, localidade: 'Vila Aviso' } },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const n = await espera;
    assert.equal(n.tipo, 'produtor-novo');
    assert.equal(n.lida, false);
    const l = await lista(admin.token);
    assert.ok(l.json.itens.some((i) => i.id === n.id));
  });

  it('aprovar o produtor avisa o próprio produtor', async () => {
    const email = emailNovo('aprov');
    const reg = await pedir('POST', '/auth/registo', {
      corpo: { nome: 'Produtor Aprovado', email, password: 'segredo123', papel: 'produtor', produtor: { nomeExploracao: 'Quinta Aprovada', localidade: 'Vila Aprovada' } },
    });
    const dono = await entrar(email, 'segredo123');
    const sDono = await ligar(dono.token);
    const espera = esperar(sDono, 'notificacao', 5000, (n) => n.tipo === 'conta');
    const v = await pedir('PATCH', `/admin/produtores/${reg.json.id}/validacao`, { corpo: { aprovado: true }, token: admin.token });
    assert.equal(v.status, 200);
    assert.match((await espera).texto, /aprovada/);
  });

  it('encomenda nova avisa o produtor; mudar o estado avisa o comprador', async () => {
    const produtos = (await pedir('GET', '/products')).json.filter((p) => String(p.produtor._id) === horta.id && p.stock > 0);
    assert.ok(produtos.length > 0, 'O seed devia ter produtos da horta com stock');

    const sHorta = await ligar(horta.token);
    const sTasca = await ligar(tasca.token);

    const aviso = esperar(sHorta, 'notificacao', 5000, (n) => n.tipo === 'encomenda-nova');
    const e = await pedir('POST', '/orders', { token: tasca.token, corpo: { linhas: [{ produto: produtos[0]._id, quantidade: 1 }] } });
    assert.equal(e.status, 201, JSON.stringify(e.json));
    assert.match((await aviso).texto, /Nova encomenda/);

    const avisoEstado = esperar(sTasca, 'notificacao', 5000, (n) => n.tipo === 'encomenda-estado');
    const m = await pedir('PATCH', `/orders/${e.json[0].id}/estado`, { token: horta.token, corpo: { estado: 'confirmada' } });
    assert.equal(m.status, 200, JSON.stringify(m.json));
    assert.match((await avisoEstado).texto, /confirmou/);
  });
});

describe('Notificações: marcar como lidas', () => {
  it('POST /lidas: 204 e naoLidas fica a 0; só afeta o próprio utilizador', async () => {
    const antesAdmin = (await lista(admin.token)).json.naoLidas;
    assert.ok((await lista(horta.token)).json.naoLidas > 0, 'A horta devia ter notificações por ler');

    assert.equal((await pedir('POST', '/notifications/lidas', { token: horta.token })).status, 204);

    const depois = await lista(horta.token);
    assert.equal(depois.json.naoLidas, 0);
    assert.ok(depois.json.itens.every((i) => i.lida));
    assert.equal((await lista(admin.token)).json.naoLidas, antesAdmin);
  });

  it('cada utilizador só vê as suas notificações', async () => {
    const a = new Set((await lista(tasca.token)).json.itens.map((i) => i.id));
    const b = (await lista(horta.token)).json.itens.map((i) => i.id);
    assert.ok(b.every((id) => !a.has(id)));
  });
});
