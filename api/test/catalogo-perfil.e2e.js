// Testes de ponta a ponta: filtros do catálogo, perfil do produtor, estatísticas e notificações ao produtor
//
//   cd api
//   npm test
//
// Correm contra a API JÁ A CORRER, com o seed feito. Nunca os apontes à base de produção.
// Cada teste cria os seus próprios produtores (aprovados pelo admin), por isso pode repetir-se.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const URL_SOCKET = process.env.SOCKET_URL || BASE.replace(/\/api\/?$/, '');
const SEED = { comprador: 'tasca@exemplo.pt', produtor: 'horta@exemplo.pt', produtor2: 'mel@exemplo.pt', admin: 'admin@exemplo.pt', password: 'password123' };
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
  return { status: res.status, json, headers: res.headers };
}

async function entrar(email, password = SEED.password) {
  const r = await pedir('POST', '/auth/login', { corpo: { email, password } });
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return { token: r.json.token, id: r.json.utilizador.id };
}

let admin, tasca, horta, mel;

// Produtor novo, já aprovado pelo admin. O nome e a localidade são únicos, para os filtros o isolarem.
async function novoProdutor(prefixo) {
  const email = emailNovo(prefixo);
  const nome = `Quinta${prefixo}${unico}`;
  const localidade = `Vila${prefixo}${unico}`;
  const r = await pedir('POST', '/auth/registo', {
    corpo: { nome, email, password: 'segredo123', papel: 'produtor', produtor: { nomeExploracao: nome, localidade } },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const v = await pedir('PATCH', `/admin/produtores/${r.json.id}/validacao`, { corpo: { aprovado: true }, token: admin.token });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  const { token, id } = await entrar(email, 'segredo123');
  return { token, id, nome, localidade };
}

const criarProduto = async (dono, extra = {}) => {
  const r = await pedir('POST', '/products', {
    token: dono.token,
    corpo: { nome: `Produto ${++contador}`, categoria: 'Fruta', preco: 2.5, unidade: 'kg', stock: 5, ...extra },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
};

const encomendar = (token, linhas) => pedir('POST', '/orders', { token, corpo: { linhas } });

// ---------- Socket.io ----------
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

before(async () => {
  try {
    assert.equal((await fetch(BASE + '/health')).status, 200);
  } catch {
    throw new Error(`A API não responde em ${BASE}. Arranca-a com "npm run dev" (noutro terminal).`);
  }
  admin = await entrar(SEED.admin);
  tasca = await entrar(SEED.comprador);
  horta = await entrar(SEED.produtor);
  mel = await entrar(SEED.produtor2);
});

after(() => { for (const s of sockets) s.close(); });

// ---------- filtros do catálogo ----------
describe('Catálogo: localidade e pesquisa por produtor', () => {
  it('localidade=Ponte: só produtos de produtores dessa localidade', async () => {
    const r = await pedir('GET', '/products?localidade=Ponte');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(r.json.length > 0);
    assert.ok(r.json.every((p) => p.produtor.produtor.localidade.includes('Ponte')));
    assert.ok(r.json.some((p) => String(p.produtor._id) === horta.id));
    assert.ok(!r.json.some((p) => String(p.produtor._id) === mel.id));
  });

  it('localidade como objeto (?localidade[$ne]=x): 400', async () => {
    assert.equal((await pedir('GET', '/products?localidade[$ne]=x')).status, 400);
  });

  it('localidade desconhecida: 200 com lista vazia', async () => {
    const r = await pedir('GET', `/products?localidade=Inexistente${unico}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, []);
  });

  it('q com o nome do produtor devolve os produtos desse produtor', async () => {
    const dono = await novoProdutor('pesq');
    const p = await criarProduto(dono, { nome: 'Pêssego' });
    const r = await pedir('GET', `/products?q=${encodeURIComponent(dono.nome)}`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.json.map((x) => x._id), [p._id]);
  });

  it('q com o nome do produto continua a funcionar', async () => {
    const r = await pedir('GET', '/products?q=kiwi');
    assert.equal(r.status, 200);
    assert.ok(r.json.length > 0);
    assert.ok(r.json.every((p) => /kiwi/i.test(p.nome)));
  });

  it('localidade única isola os produtos de um só produtor', async () => {
    const dono = await novoProdutor('loc');
    const p = await criarProduto(dono);
    const r = await pedir('GET', `/products?localidade=${encodeURIComponent(dono.localidade)}`);
    assert.deepEqual(r.json.map((x) => x._id), [p._id]);
  });

  it('produtor + q de outro produtor: nenhum resultado (as condições somam-se)', async () => {
    const r = await pedir('GET', `/products?produtor=${horta.id}&q=${encodeURIComponent('Mel do Soajo')}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, []);
  });

  it('localidade + bio=true: só biológicos dessa localidade', async () => {
    const r = await pedir('GET', '/products?localidade=Ponte&bio=true');
    assert.equal(r.status, 200);
    assert.ok(r.json.length > 0);
    assert.ok(r.json.every((p) => p.biologico && p.produtor.produtor.localidade.includes('Ponte')));
  });

  it('localidade com caracteres de regex não rebenta: 200', async () => {
    assert.equal((await pedir('GET', `/products?localidade=${encodeURIComponent('(.*[')}`)).status, 200);
  });
});

// ---------- perfil público ----------
describe('Produtor: PATCH /producers/me', () => {
  const editar = (token, corpo) => pedir('PATCH', '/producers/me', { token, corpo });

  it('sem token: 401; comprador: 403', async () => {
    assert.equal((await editar(undefined, { descricao: 'x' })).status, 401);
    assert.equal((await editar(tasca.token, { descricao: 'x' })).status, 403);
  });

  it('altera os dados e a página pública mostra-os, com a localização', async () => {
    const dono = await novoProdutor('perfil');
    const r = await editar(dono.token, {
      nomeExploracao: 'Quinta Nova',
      localidade: 'Monção',
      descricao: '  Vinho e fruta.  ',
      localizacao: { lat: 42.078, lng: -8.481 },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.descricao, 'Vinho e fruta.');

    const pub = await pedir('GET', `/producers/${dono.id}`);
    assert.equal(pub.json.produtor.nomeExploracao, 'Quinta Nova');
    assert.equal(pub.json.produtor.localidade, 'Monção');
    assert.deepEqual({ ...pub.json.produtor.localizacao }, { lat: 42.078, lng: -8.481 });

    const eu = await pedir('GET', '/auth/eu', { token: dono.token });
    assert.equal(eu.json.produtor.localidade, 'Monção');
  });

  it('só altera o que é enviado', async () => {
    const dono = await novoProdutor('parcial');
    await editar(dono.token, { descricao: 'Só isto' });
    const pub = await pedir('GET', `/producers/${dono.id}`);
    assert.equal(pub.json.produtor.descricao, 'Só isto');
    assert.equal(pub.json.produtor.localidade, dono.localidade);
  });

  it('localizacao null apaga a posição', async () => {
    const dono = await novoProdutor('apagar');
    await editar(dono.token, { localizacao: { lat: 41, lng: -8 } });
    const r = await editar(dono.token, { localizacao: null });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const pub = await pedir('GET', `/producers/${dono.id}`);
    assert.equal(pub.json.produtor.localizacao?.lat, undefined);
  });

  it('um produtor por validar não se aprova a si próprio com "validado": true', async () => {
    const email = emailNovo('semvalidar');
    const reg = await pedir('POST', '/auth/registo', {
      corpo: { nome: 'Sem Validar', email, password: 'segredo123', papel: 'produtor', produtor: { nomeExploracao: 'Sem Validar', localidade: 'Valença' } },
    });
    assert.equal(reg.status, 201);
    const { token } = await entrar(email, 'segredo123');
    const r = await editar(token, { descricao: 'x', validado: true, produtor: { validado: true } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const eu = await pedir('GET', '/auth/eu', { token });
    assert.equal(eu.json.produtor.validado, false);
  });

  for (const [descricao, corpo] of [
    ['corpo vazio', {}],
    ['nomeExploracao vazio', { nomeExploracao: '   ' }],
    ['nomeExploracao que não é texto', { nomeExploracao: 5 }],
    ['localidade enorme', { localidade: 'a'.repeat(101) }],
    ['descricao que não é texto', { descricao: 5 }],
    ['descricao enorme', { descricao: 'a'.repeat(1001) }],
    ['latitude acima de 90', { localizacao: { lat: 91, lng: 0 } }],
    ['longitude abaixo de -180', { localizacao: { lat: 0, lng: -181 } }],
    ['latitude em texto', { localizacao: { lat: '41', lng: -8 } }],
    ['localizacao sem longitude', { localizacao: { lat: 41 } }],
    ['localizacao que não é objeto', { localizacao: 'Monção' }],
  ]) {
    it(`${descricao}: 400`, async () => {
      const dono = await novoProdutor('invalido');
      const r = await editar(dono.token, corpo);
      assert.equal(r.status, 400, JSON.stringify(r.json));
    });
  }
});

// ---------- estatísticas ----------
describe('Produtor: GET /producers/me/estatisticas', () => {
  it('sem token: 401; comprador: 403', async () => {
    assert.equal((await pedir('GET', '/producers/me/estatisticas')).status, 401);
    assert.equal((await pedir('GET', '/producers/me/estatisticas', { token: tasca.token })).status, 403);
  });

  it('um produtor novo começa a zero', async () => {
    const dono = await novoProdutor('zero');
    const r = await pedir('GET', '/producers/me/estatisticas', { token: dono.token });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.json, {
      vendasMes: 0, encomendasMes: 0, encomendasPorTratar: 0, produtosAtivos: 0,
      produtosComStockBaixo: 0, avaliacaoMedia: null, numAvaliacoes: 0, leiloesAtivos: 0,
    });
  });

  it('os números acompanham os produtos, as encomendas e os leilões', async () => {
    const dono = await novoProdutor('numeros');
    const p = await criarProduto(dono, { preco: 2.5, stock: 5 });
    await criarProduto(dono, { stock: 0 });
    await criarProduto(dono, { stock: 50 });

    let e = (await pedir('GET', '/producers/me/estatisticas', { token: dono.token })).json;
    assert.equal(e.produtosAtivos, 2, 'só contam os produtos com stock');
    assert.equal(e.produtosComStockBaixo, 2, 'stock até 10 (inclui o esgotado)');

    const enc = await encomendar(tasca.token, [{ produto: p._id, quantidade: 2 }]);
    assert.equal(enc.status, 201, JSON.stringify(enc.json));
    e = (await pedir('GET', '/producers/me/estatisticas', { token: dono.token })).json;
    assert.equal(e.vendasMes, 5);
    assert.equal(e.encomendasMes, 1);
    assert.equal(e.encomendasPorTratar, 1);

    const mudar = await pedir('PATCH', `/orders/${enc.json[0].id}/estado`, { token: dono.token, corpo: { estado: 'confirmada' } });
    assert.equal(mudar.status, 200, JSON.stringify(mudar.json));
    e = (await pedir('GET', '/producers/me/estatisticas', { token: dono.token })).json;
    assert.equal(e.encomendasPorTratar, 0, 'só as pendentes estão por tratar');
    assert.equal(e.vendasMes, 5, 'confirmar não muda as vendas');

    const leilao = await pedir('POST', '/auctions', { token: dono.token, corpo: { lote: 'Lote', precoBase: 10, incremento: 1, duracaoMinutos: 10 } });
    assert.equal(leilao.status, 201);
    e = (await pedir('GET', '/producers/me/estatisticas', { token: dono.token })).json;
    assert.equal(e.leiloesAtivos, 1);
  });

  it('não mistura as encomendas de outro produtor', async () => {
    const a = await novoProdutor('isolaA');
    const b = await novoProdutor('isolaB');
    const p = await criarProduto(a, { stock: 5 });
    await encomendar(tasca.token, [{ produto: p._id, quantidade: 1 }]);
    const e = (await pedir('GET', '/producers/me/estatisticas', { token: b.token })).json;
    assert.equal(e.encomendasMes, 0);
  });
});

// ---------- notificações ao produtor ----------
describe('Notificações em tempo real ao produtor', () => {
  it('uma encomenda nova avisa o produtor', async () => {
    const dono = await novoProdutor('aviso');
    const p = await criarProduto(dono, { preco: 4, stock: 5 });
    const s = await ligar(dono.token);

    const aviso = esperar(s, 'encomenda-nova');
    const r = await encomendar(tasca.token, [{ produto: p._id, quantidade: 2 }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const n = await aviso;
    assert.equal(n.id, r.json[0].id);
    assert.equal(n.total, 8);
  });

  it('um produtor não recebe os avisos das encomendas de outro', async () => {
    const a = await novoProdutor('privA');
    const b = await novoProdutor('privB');
    const p = await criarProduto(a, { stock: 5 });
    const sb = await ligar(b.token);
    let recebeu = false;
    sb.on('encomenda-nova', () => { recebeu = true; });
    const sa = await ligar(a.token);
    const aviso = esperar(sa, 'encomenda-nova');
    await encomendar(tasca.token, [{ produto: p._id, quantidade: 1 }]);
    await aviso;
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(recebeu, false);
  });

  it('quando o leilão termina com vencedor, o produtor é avisado do fim e da encomenda', { timeout: 60_000 }, async () => {
    const dono = await novoProdutor('fimleilao');
    const l = await pedir('POST', '/auctions', { token: dono.token, corpo: { lote: 'Lote do aviso', precoBase: 20, incremento: 1, duracaoMinutos: 0.25 } });
    assert.equal(l.status, 201, JSON.stringify(l.json));

    const sProdutor = await ligar(dono.token);
    const sComprador = await ligar(tasca.token);
    const sala = esperar(sComprador, 'estado', 5000, (e) => e.leilao.id === l.json.id);
    sComprador.emit('entrar', l.json.id);
    await sala;
    const lic = esperar(sComprador, 'nova-licitacao');
    sComprador.emit('licitar', { leilaoId: l.json.id, valor: 21 });
    await lic;

    const [fim, nova] = await Promise.all([
      esperar(sProdutor, 'leilao-terminado', 45_000, (t) => t.leilaoId === l.json.id),
      esperar(sProdutor, 'encomenda-nova', 45_000),
    ]);
    assert.equal(fim.vencedor.id, tasca.id);
    assert.equal(fim.valor, 21);
    assert.equal(nova.total, 21);
  });
});
