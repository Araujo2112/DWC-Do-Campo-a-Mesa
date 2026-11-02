// Testes de ponta a ponta da API
//
//   cd api
//   node --test test/e2e.js
//
// Correm contra a API JÁ A CORRER, com o seed feito. Nunca os apontes à base de produção:
// cada execução cria utilizadores @teste.pt.

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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
  return { status: res.status, json, headers: res.headers };
}

const registar = (corpo) => pedir('POST', '/auth/registo', { corpo });
const login = (email, password = SEED.password) =>
  pedir('POST', '/auth/login', { corpo: { email, password } });

async function tokenDe(email, password = SEED.password) {
  const r = await login(email, password);
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return r.json.token;
}

const b64 = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');

function payloadJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

// Token assinado com um segredo que NÃO é o do servidor.
function tokenAssinadoComSegredoErrado(payload) {
  const cabecalho = b64({ alg: 'HS256', typ: 'JWT' });
  const corpo = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 });
  const assinatura = crypto.createHmac('sha256', 'segredo-errado').update(`${cabecalho}.${corpo}`).digest('base64url');
  return `${cabecalho}.${corpo}.${assinatura}`;
}

const compradorValido = (email) => ({ nome: 'Teste Comprador', email, password: 'segredo123' });

// Cria um produtor novo (fica por validar) e devolve o seu id e email.
async function novoProdutor(prefixo) {
  const email = emailNovo(prefixo);
  const r = await registar({
    nome: `Quinta ${prefixo}`,
    email,
    password: 'segredo123',
    papel: 'produtor',
    produtor: { nomeExploracao: `Quinta ${prefixo}`, localidade: 'Viana do Castelo' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { id: r.json.id, email };
}

const validar = (id, aprovado, token) =>
  pedir('PATCH', `/admin/produtores/${id}/validacao`, { corpo: { aprovado }, token });

const naoBloqueado = (status) => ![401, 403].includes(status);

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
    ['password com mais de 72 bytes', (c) => { c.password = 'a'.repeat(73); }],
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

  it('produtor sem nomeExploracao: 400', async () => {
    const r = await registar({
      nome: 'Sem Quinta',
      email: emailNovo('semquinta'),
      password: 'segredo123',
      papel: 'produtor',
      produtor: { localidade: 'Viana do Castelo' },
    });
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });

  it('produtor completo: guarda nomeExploracao e localidade', async () => {
    const email = emailNovo('produtorcompleto');
    const r = await registar({
      nome: 'Quinta Completa',
      email,
      password: 'segredo123',
      papel: 'produtor',
      produtor: { nomeExploracao: 'Quinta Completa', localidade: 'Ponte de Lima', descricao: 'Teste' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const l = await login(email, 'segredo123');
    assert.equal(l.status, 200);
    assert.equal(l.json.utilizador.produtor.nomeExploracao, 'Quinta Completa');
    assert.equal(l.json.utilizador.produtor.localidade, 'Ponte de Lima');
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

  it('um comprador não leva o objeto "produtor"', async () => {
    const r = await login(SEED.comprador);
    assert.equal(r.json.utilizador.produtor, undefined);
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

// ---------- tokens falsificados ----------
describe('Segurança: tokens falsificados', () => {
  it('token de admin assinado com outro segredo: 401', async () => {
    const falso = tokenAssinadoComSegredoErrado({ id: '000000000000000000000000', papel: 'admin' });
    assert.equal((await pedir('GET', '/admin/estatisticas', { token: falso })).status, 401);
  });

  it('token com alg "none" (sem assinatura): 401', async () => {
    const semAssinatura = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: '000000000000000000000000', papel: 'admin' })}.`;
    assert.equal((await pedir('GET', '/admin/estatisticas', { token: semAssinatura })).status, 401);
  });
});

// ---------- cabeçalhos HTTP ----------
describe('Segurança: cabeçalhos HTTP (helmet)', () => {
  it('envia X-Content-Type-Options: nosniff', async () => {
    const r = await pedir('GET', '/health');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  it('não revela a tecnologia (sem X-Powered-By)', async () => {
    const r = await pedir('GET', '/health');
    assert.equal(r.headers.get('x-powered-by'), null);
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

  it('admin: 200 com os contadores', async () => {
    const token = await tokenDe(SEED.admin);
    const r = await pedir('GET', '/admin/estatisticas', { token });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    for (const campo of ['utilizadores', 'produtores', 'produtoresPorValidar', 'encomendasHoje', 'leiloesAtivos']) {
      assert.equal(typeof r.json[campo], 'number', `falta o contador "${campo}"`);
    }
  });
});

// ---------- admin: validação de produtores ----------
describe('Admin: validação de produtores', () => {
  it('GET /admin/produtores/pendentes sem token: 401', async () => {
    assert.equal((await pedir('GET', '/admin/produtores/pendentes')).status, 401);
  });

  it('GET /admin/produtores/pendentes como comprador: 403', async () => {
    const token = await tokenDe(SEED.comprador);
    assert.equal((await pedir('GET', '/admin/produtores/pendentes', { token })).status, 403);
  });

  it('um produtor novo aparece nos pendentes', async () => {
    const { id } = await novoProdutor('pendente');
    const token = await tokenDe(SEED.admin);
    const r = await pedir('GET', '/admin/produtores/pendentes', { token });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(Array.isArray(r.json));
    assert.ok(r.json.some((p) => p.id === id), 'o produtor novo devia estar nos pendentes');
    assert.ok(!JSON.stringify(r.json).toLowerCase().includes('hash'));
  });

  it('aprovar: 200, o produtor fica validado e sai dos pendentes', async () => {
    const { id, email } = await novoProdutor('aprovar');
    const token = await tokenDe(SEED.admin);

    const v = await validar(id, true, token);
    assert.equal(v.status, 200, JSON.stringify(v.json));
    assert.equal(v.json.produtor.validado, true);

    const l = await login(email, 'segredo123');
    assert.equal(l.json.utilizador.produtor.validado, true);

    const pend = await pedir('GET', '/admin/produtores/pendentes', { token });
    assert.ok(!pend.json.some((p) => p.id === id), 'um produtor aprovado não devia estar nos pendentes');
  });

  it('rejeitar: 200, continua não validado, marcado como rejeitado e sai dos pendentes', async () => {
    const { id, email } = await novoProdutor('rejeitar');
    const token = await tokenDe(SEED.admin);

    const v = await validar(id, false, token);
    assert.equal(v.status, 200, JSON.stringify(v.json));

    const l = await login(email, 'segredo123');
    assert.equal(l.json.utilizador.produtor.validado, false);
    assert.equal(l.json.utilizador.produtor.rejeitado, true);

    const pend = await pedir('GET', '/admin/produtores/pendentes', { token });
    assert.ok(!pend.json.some((p) => p.id === id), 'um produtor rejeitado não devia estar nos pendentes');
  });

  it('"aprovado" que não é booleano (texto "false"): 400', async () => {
    const { id } = await novoProdutor('naobooleano');
    const token = await tokenDe(SEED.admin);
    assert.equal((await validar(id, 'false', token)).status, 400);
  });

  it('id inválido: 400', async () => {
    const token = await tokenDe(SEED.admin);
    assert.equal((await validar('isto-nao-e-um-id', true, token)).status, 400);
  });

  it('id que não existe: 404', async () => {
    const token = await tokenDe(SEED.admin);
    assert.equal((await validar('000000000000000000000000', true, token)).status, 404);
  });

  it('id de um comprador (não é produtor): 404', async () => {
    const r = await registar(compradorValido(emailNovo('naoeprodutor')));
    const token = await tokenDe(SEED.admin);
    assert.equal((await validar(r.json.id, true, token)).status, 404);
  });

  it('um produtor não pode aprovar-se a si próprio: 403', async () => {
    const { id, email } = await novoProdutor('autoaprovar');
    const l = await login(email, 'segredo123');
    assert.equal((await validar(id, true, l.json.token)).status, 403);
  });
});

// ---------- produtor validado ----------
describe('Produtor por validar não publica (middleware produtorValidado)', () => {
  const ROTAS = [
    ['POST', '/products', { nome: 'X', categoria: 'Fruta', preco: 1 }],
    ['PUT', '/products/000000000000000000000000', { nome: 'X', categoria: 'Fruta', preco: 1 }],
    ['DELETE', '/products/000000000000000000000000', undefined],
    ['POST', '/auctions', {}],
  ];

  for (const [metodo, caminho, corpo] of ROTAS) {
    const nome = `${metodo} ${caminho.replace('000000000000000000000000', ':id')}`;

    it(`${nome}: sem token: 401`, async () => {
      assert.equal((await pedir(metodo, caminho, { corpo })).status, 401);
    });

    it(`${nome}: comprador: 403`, async () => {
      const token = await tokenDe(SEED.comprador);
      assert.equal((await pedir(metodo, caminho, { corpo, token })).status, 403);
    });

    it(`${nome}: produtor por validar: 403`, async () => {
      const { email } = await novoProdutor('porvalidar');
      const token = await tokenDe(email, 'segredo123');
      assert.equal((await pedir(metodo, caminho, { corpo, token })).status, 403);
    });

    it(`${nome}: produtor validado passa o controlo de acesso`, async () => {
      const token = await tokenDe(SEED.produtor);
      const r = await pedir(metodo, caminho, { corpo, token });
      assert.ok(naoBloqueado(r.status), `Recebeu ${r.status}: um produtor validado não devia ser bloqueado`);
    });
  }

  it('produtor rejeitado: 403', async () => {
    const { id, email } = await novoProdutor('rejeitadoproduto');
    const admin = await tokenDe(SEED.admin);
    await validar(id, false, admin);
    const token = await tokenDe(email, 'segredo123');
    assert.equal((await pedir('POST', '/products', { corpo: {}, token })).status, 403);
  });

  it('a aprovação vale logo, com o MESMO token (o servidor consulta a BD, não o JWT)', async () => {
    const { id, email } = await novoProdutor('aprovadodepois');
    const tokenAntigo = await tokenDe(email, 'segredo123');

    assert.equal((await pedir('POST', '/products', { corpo: {}, token: tokenAntigo })).status, 403);

    const admin = await tokenDe(SEED.admin);
    assert.equal((await validar(id, true, admin)).status, 200);

    const depois = await pedir('POST', '/products', { corpo: {}, token: tokenAntigo });
    assert.ok(naoBloqueado(depois.status), `Recebeu ${depois.status} depois de aprovado`);
  });
});

// ---------- GET /products: parâmetros ----------
describe('GET /products: parâmetros', () => {
  it('sem filtros: 200 com a lista', async () => {
    const r = await pedir('GET', '/products');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(Array.isArray(r.json));
  });

  it('bio=true: só produtos biológicos', async () => {
    const r = await pedir('GET', '/products?bio=true');
    assert.equal(r.status, 200);
    assert.ok(r.json.every((p) => p.biologico === true));
  });

  it('categoria como objeto (?categoria[$ne]=x): 400 (injeção NoSQL)', async () => {
    assert.equal((await pedir('GET', '/products?categoria[$ne]=Fruta')).status, 400);
  });

  it('q como objeto (?q[$gt]=a): 400', async () => {
    assert.equal((await pedir('GET', '/products?q[$gt]=a')).status, 400);
  });

  it('q com caracteres de regex não rebenta: 200', async () => {
    const r = await pedir('GET', '/products?q=' + encodeURIComponent('(.*['));
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });

  it('precoMax que não é número: 400', async () => {
    assert.equal((await pedir('GET', '/products?precoMax=abc')).status, 400);
  });
});