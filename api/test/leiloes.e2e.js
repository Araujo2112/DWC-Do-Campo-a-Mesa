// Testes de ponta a ponta: leilões (REST e Socket.io)
//
//   cd api
//   npm test
//
// Correm contra a API JÁ A CORRER, com o seed feito. Nunca os apontes à base de produção.
// Os leilões e os utilizadores @teste.pt que criam ficam na base (o próximo "npm run seed" apaga tudo).
// O teste "termina sozinho" demora cerca de 20 s: espera pelo fecho do leilão.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const URL_SOCKET = process.env.SOCKET_URL || BASE.replace(/\/api\/?$/, '');
const SEED = {
  comprador: 'tasca@exemplo.pt',
  produtor: 'horta@exemplo.pt',
  produtor2: 'mel@exemplo.pt',
  password: 'password123',
};
const unico = Date.now();
let contador = 0;
const emailNovo = (prefixo) => `${prefixo}.${unico}.${++contador}@teste.pt`;

// ---------- auxiliares REST ----------
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

async function entrar(email, password = SEED.password) {
  const r = await pedir('POST', '/auth/login', { corpo: { email, password } });
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return { token: r.json.token, id: r.json.utilizador.id };
}

async function novoComprador() {
  const email = emailNovo('licitador');
  const r = await pedir('POST', '/auth/registo', { corpo: { nome: `Licitador ${contador}`, email, password: 'segredo123' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return entrar(email, 'segredo123');
}

let horta, mel, tasca;

async function criarLeilao(extra = {}) {
  const r = await pedir('POST', '/auctions', {
    token: horta.token,
    corpo: { lote: `Lote de teste ${++contador}`, precoBase: 50, incremento: 5, duracaoMinutos: 10, ...extra },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

const leilaoNaApi = async (id) => (await pedir('GET', `/auctions/${id}`)).json;

// ---------- auxiliares Socket.io ----------
const sockets = [];

function ligar(token) {
  return new Promise((resolve, reject) => {
    const s = io(URL_SOCKET, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

// Espera por um evento (registar ANTES de emitir, para não o perder)
function esperar(s, evento, ms = 5000, filtro = () => true) {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => {
      s.off(evento, aoReceber);
      reject(new Error(`Tempo esgotado à espera de "${evento}"`));
    }, ms);
    function aoReceber(dados) {
      if (!filtro(dados)) return;
      clearTimeout(temporizador);
      s.off(evento, aoReceber);
      resolve(dados);
    }
    s.on(evento, aoReceber);
  });
}

async function esperarCondicao(condicao, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (condicao()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail('A condição não se cumpriu a tempo');
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function entrarNaSala(s, id) {
  const p = esperar(s, 'estado', 5000, (e) => e.leilao.id === id);
  s.emit('entrar', id);
  return p;
}

// Emite uma licitação e devolve a mensagem de recusa
async function licitarRecusada(s, leilaoId, valor) {
  const p = esperar(s, 'recusada');
  s.emit('licitar', { leilaoId, valor });
  return p;
}

before(async () => {
  try {
    const r = await fetch(BASE + '/health');
    assert.equal(r.status, 200);
  } catch {
    throw new Error(`A API não responde em ${BASE}. Arranca-a com "npm run dev" (noutro terminal).`);
  }
  horta = await entrar(SEED.produtor);
  mel = await entrar(SEED.produtor2);
  tasca = await entrar(SEED.comprador);
});

after(() => {
  for (const s of sockets) s.close();
});

// ---------- REST ----------
describe('Leilões: REST', () => {
  it('POST válido: 201, Location, valor inicial = preço base e termina na hora certa', async () => {
    const antes = Date.now();
    const r = await pedir('POST', '/auctions', {
      token: horta.token,
      corpo: { lote: '200 kg de kiwi', quantidade: '200 kg', precoBase: 200, incremento: 5, duracaoMinutos: 30 },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.headers.get('location'), `/api/auctions/${r.json.id}`);
    assert.equal(r.json.estado, 'ativo');
    assert.equal(r.json.licitacaoAtual.valor, 200);
    assert.equal(r.json.licitacaoAtual.comprador, null);
    assert.equal(r.json.numLicitacoes, 0);
    assert.equal(r.json.produtor.id, horta.id, 'o dono vem do token');
    assert.equal(new Date(r.json.terminaEm) - new Date(r.json.iniciaEm), 30 * 60_000);
    assert.ok(Math.abs(new Date(r.json.iniciaEm) - antes) < 10_000, 'sem iniciaEm, começa agora');
  });

  const base = { lote: 'X', precoBase: 10, incremento: 1, duracaoMinutos: 10 };
  const passado = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const longe = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  for (const [descricao, corpo] of [
    ['sem lote', { ...base, lote: undefined }],
    ['lote vazio', { ...base, lote: '   ' }],
    ['quantidade que não é texto', { ...base, quantidade: 5 }],
    ['preço base negativo', { ...base, precoBase: -1 }],
    ['preço base em texto', { ...base, precoBase: '10' }],
    ['preço base com 3 casas decimais', { ...base, precoBase: 10.123 }],
    ['incremento 0', { ...base, incremento: 0 }],
    ['incremento em texto', { ...base, incremento: '1' }],
    ['duração abaixo do mínimo', { ...base, duracaoMinutos: 0.1 }],
    ['duração acima do máximo', { ...base, duracaoMinutos: 2000 }],
    ['duração em texto', { ...base, duracaoMinutos: '10' }],
    ['início que não é data', { ...base, iniciaEm: 'amanhã' }],
    ['início que não é texto', { ...base, iniciaEm: 123 }],
    ['início no passado', { ...base, iniciaEm: passado }],
    ['início daqui a mais de 30 dias', { ...base, iniciaEm: longe }],
    ['produto com id inválido', { ...base, produto: 'abc' }],
  ]) {
    it(`POST ${descricao}: 400`, async () => {
      const r = await pedir('POST', '/auctions', { token: horta.token, corpo });
      assert.equal(r.status, 400, JSON.stringify(r.json));
    });
  }

  it('POST com o produto de outro produtor: 400', async () => {
    const p = await pedir('POST', '/products', {
      token: mel.token,
      corpo: { nome: 'Produto do Mel (teste)', categoria: 'Mel', preco: 5, stock: 1 },
    });
    assert.equal(p.status, 201, JSON.stringify(p.json));
    try {
      const r = await pedir('POST', '/auctions', { token: horta.token, corpo: { ...base, produto: p.json._id } });
      assert.equal(r.status, 400, JSON.stringify(r.json));
    } finally {
      await pedir('DELETE', `/products/${p.json._id}`, { token: mel.token });
    }
  });

  it('POST com início futuro: fica "agendado"', async () => {
    const r = await pedir('POST', '/auctions', {
      token: horta.token,
      corpo: { ...base, iniciaEm: new Date(Date.now() + 60_000).toISOString() },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.estado, 'agendado');
  });

  it('GET ?estado=ativo: inclui o novo, só ativos e os que terminam primeiro vêm antes', async () => {
    const a = await criarLeilao();
    const r = await pedir('GET', '/auctions?estado=ativo');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok(r.json.some((x) => x.id === a.id));
    assert.ok(r.json.every((x) => x.estado === 'ativo'));
    const fins = r.json.map((x) => new Date(x.terminaEm).getTime());
    assert.deepEqual(fins, [...fins].sort((x, y) => x - y));
  });

  it('GET ?estado inválido: 400; estado como objeto: 400; produtor inválido: 400', async () => {
    assert.equal((await pedir('GET', '/auctions?estado=aberto')).status, 400);
    assert.equal((await pedir('GET', '/auctions?estado[$ne]=ativo')).status, 400);
    assert.equal((await pedir('GET', '/auctions?produtor=abc')).status, 400);
  });

  it('GET ?produtor=<id>: só leilões desse produtor', async () => {
    await criarLeilao();
    const r = await pedir('GET', `/auctions?produtor=${horta.id}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.length > 0);
    assert.ok(r.json.every((x) => x.produtor.id === horta.id));
  });

  it('GET /:id: 200 com o leilão, o produtor e a lista de licitações', async () => {
    const a = await criarLeilao();
    const r = await pedir('GET', `/auctions/${a.id}`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.id, a.id);
    assert.ok(r.json.produtor.nome);
    assert.ok(Array.isArray(r.json.licitacoes));
  });

  it('GET /:id com id inválido: 400; inexistente: 404', async () => {
    assert.equal((await pedir('GET', '/auctions/abc')).status, 400);
    assert.equal((await pedir('GET', '/auctions/000000000000000000000000')).status, 404);
  });

  it('GET /:id/bids: 200 (vazio num leilão novo); limite inválido: 400; inexistente: 404', async () => {
    const a = await criarLeilao();
    const r = await pedir('GET', `/auctions/${a.id}/bids`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, []);
    assert.equal((await pedir('GET', `/auctions/${a.id}/bids?limite=0`)).status, 400);
    assert.equal((await pedir('GET', `/auctions/${a.id}/bids?limite=abc`)).status, 400);
    assert.equal((await pedir('GET', '/auctions/000000000000000000000000/bids')).status, 404);
  });
});

// ---------- Socket.io: ligação e sala ----------
describe('Leilões: ligação e sala', () => {
  it('sem token: ligação recusada', async () => {
    await assert.rejects(ligar(undefined), /não autorizado/);
  });

  it('token inválido: ligação recusada', async () => {
    await assert.rejects(ligar('abc.def.ghi'), /não autorizado/);
  });

  it('entrar: recebe o estado com terminaEm e o relógio do servidor', async () => {
    const a = await criarLeilao();
    const s = await ligar(tasca.token);
    const e = await entrarNaSala(s, a.id);
    assert.equal(e.leilao.lote, a.lote);
    assert.equal(e.leilao.estado, 'ativo');
    assert.ok(e.leilao.terminaEm);
    assert.ok(Math.abs(e.agora - Date.now()) < 5000, 'o servidor envia o seu relógio');
    assert.deepEqual(e.licitacoes, []);
  });

  it('entrar com id inválido ou inexistente: recusada', async () => {
    const s = await ligar(tasca.token);
    let p = esperar(s, 'recusada');
    s.emit('entrar', 'abc');
    assert.match(await p, /inválido/);
    p = esperar(s, 'recusada');
    s.emit('entrar', '000000000000000000000000');
    assert.match(await p, /não encontrado/);
  });

  it('presença: conta participantes distintos e atualiza quando alguém sai', async () => {
    const a = await criarLeilao();
    const outro = await novoComprador();
    const s1 = await ligar(tasca.token);
    await entrarNaSala(s1, a.id);

    const doisNaSala = esperar(s1, 'presenca', 5000, (n) => n === 2);
    const s2 = await ligar(outro.token);
    await entrarNaSala(s2, a.id);
    await doisNaSala;

    const umNaSala = esperar(s1, 'presenca', 5000, (n) => n === 1);
    s2.disconnect();
    await umNaSala;
  });

  it('o mesmo utilizador com dois separadores conta uma vez', async () => {
    const a = await criarLeilao();
    const s1 = await ligar(tasca.token);
    const s2 = await ligar(tasca.token);
    await entrarNaSala(s1, a.id);
    const p = esperar(s1, 'presenca');
    await entrarNaSala(s2, a.id);
    assert.equal(await p, 1);
  });

  it('payloads malformados não derrubam o servidor', async () => {
    const s = await ligar(tasca.token);
    for (const x of [undefined, null, 'abc', 42, {}, [], { leilaoId: { $ne: null }, valor: 'x' }, { leilaoId: '000000000000000000000000' }]) {
      s.emit('licitar', x);
      s.emit('entrar', x);
      s.emit('sair', x);
    }
    await pausa(500);
    assert.equal(s.connected, true);
    assert.equal((await fetch(BASE + '/health')).status, 200);
  });
});

// ---------- Socket.io: licitar ----------
describe('Leilões: licitar', () => {
  it('licitação válida: todos na sala recebem a nova licitação e o leilão fica atualizado', async () => {
    const a = await criarLeilao(); // base 50, incremento 5
    const outro = await novoComprador();
    const s1 = await ligar(tasca.token);
    const s2 = await ligar(outro.token);
    await entrarNaSala(s1, a.id);
    await entrarNaSala(s2, a.id);

    const p1 = esperar(s1, 'nova-licitacao', 5000, (n) => n.leilaoId === a.id);
    const p2 = esperar(s2, 'nova-licitacao', 5000, (n) => n.leilaoId === a.id);
    s1.emit('licitar', { leilaoId: a.id, valor: 55 });
    const [n1, n2] = await Promise.all([p1, p2]);

    for (const n of [n1, n2]) {
      assert.equal(n.valor, 55);
      assert.equal(n.comprador, tasca.id);
      assert.ok(n.nome);
      assert.equal(n.numLicitacoes, 1);
    }

    const l = await leilaoNaApi(a.id);
    assert.equal(l.licitacaoAtual.valor, 55);
    assert.equal(l.licitacaoAtual.comprador, tasca.id);
    assert.equal(l.numLicitacoes, 1);
    assert.equal(l.licitacoes.length, 1);
  });

  it('o valor mínimo é atual + incremento: abaixo é recusado, igual é aceite', async () => {
    const a = await criarLeilao(); // base 50, incremento 5 -> mínimo 55
    const s = await ligar(tasca.token);
    await entrarNaSala(s, a.id);

    assert.match(await licitarRecusada(s, a.id, 54.99), /55\.00/);
    assert.match(await licitarRecusada(s, a.id, 50), /55\.00/);

    await pausa(300);
    const p = esperar(s, 'nova-licitacao');
    s.emit('licitar', { leilaoId: a.id, valor: 55 });
    assert.equal((await p).valor, 55);
  });

  it('quem lidera não licita contra si próprio; outro comprador pode superar', async () => {
    const a = await criarLeilao();
    const outro = await novoComprador();
    const s1 = await ligar(tasca.token);
    const s2 = await ligar(outro.token);
    await entrarNaSala(s1, a.id);
    await entrarNaSala(s2, a.id);

    const p = esperar(s1, 'nova-licitacao');
    s1.emit('licitar', { leilaoId: a.id, valor: 55 });
    await p;

    await pausa(300);
    assert.match(await licitarRecusada(s1, a.id, 70), /mais alto/);

    const p2 = esperar(s1, 'nova-licitacao', 5000, (n) => n.valor === 60);
    s2.emit('licitar', { leilaoId: a.id, valor: 60 });
    assert.equal((await p2).comprador, outro.id);
  });

  it('produtor não licita (a regra vive no servidor)', async () => {
    const a = await criarLeilao();
    const s = await ligar(horta.token);
    await entrarNaSala(s, a.id);
    assert.match(await licitarRecusada(s, a.id, 100), /compradores/);
    assert.equal((await leilaoNaApi(a.id)).numLicitacoes, 0);
  });

  it('valores inválidos são recusados e nada é gravado', async () => {
    const a = await criarLeilao();
    const s = await ligar(tasca.token);
    await entrarNaSala(s, a.id);
    for (const valor of ['100', null, -5, 0, 1e9, 100.123, { $gt: 0 }]) {
      await licitarRecusada(s, a.id, valor);
    }
    assert.equal((await leilaoNaApi(a.id)).numLicitacoes, 0);
  });

  it('leilão que ainda não começou: recusada', async () => {
    const a = await criarLeilao({ iniciaEm: new Date(Date.now() + 60_000).toISOString() });
    assert.equal(a.estado, 'agendado');
    const s = await ligar(tasca.token);
    await entrarNaSala(s, a.id);
    assert.match(await licitarRecusada(s, a.id, 100), /não começou/);
  });

  it('4 compradores licitam o MESMO valor ao mesmo tempo: só uma passa', async () => {
    const a = await criarLeilao();
    const compradores = [tasca, await novoComprador(), await novoComprador(), await novoComprador()];
    const ss = [];
    const novas = new Map();
    let recusadas = 0;
    for (const c of compradores) {
      const s = await ligar(c.token);
      novas.set(s, 0);
      s.on('nova-licitacao', () => novas.set(s, novas.get(s) + 1));
      s.on('recusada', () => { recusadas += 1; });
      await entrarNaSala(s, a.id);
      ss.push(s);
    }

    for (const s of ss) s.emit('licitar', { leilaoId: a.id, valor: 100 });

    await esperarCondicao(() => recusadas === 3 && ss.every((s) => novas.get(s) >= 1));
    await pausa(300); // se houvesse uma 2.ª licitação aceite, já teria chegado
    assert.equal(recusadas, 3);
    for (const s of ss) assert.equal(novas.get(s), 1, 'cada cliente vê exatamente uma licitação aceite');

    const l = await leilaoNaApi(a.id);
    assert.equal(l.licitacaoAtual.valor, 100);
    assert.equal(l.numLicitacoes, 1);
    assert.equal((await pedir('GET', `/auctions/${a.id}/bids`)).json.length, 1);
  });

  it('4 compradores licitam valores diferentes ao mesmo tempo: todos acabam a ver o mesmo estado', async () => {
    const a = await criarLeilao(); // base 50, incremento 5
    const compradores = [tasca, await novoComprador(), await novoComprador(), await novoComprador()];
    const valores = [105, 110, 115, 120];
    const ss = [];
    const maximo = new Map(); // valor mais alto que cada cliente viu
    for (const c of compradores) {
      const s = await ligar(c.token);
      maximo.set(s, 0);
      s.on('nova-licitacao', (n) => maximo.set(s, Math.max(maximo.get(s), n.valor)));
      await entrarNaSala(s, a.id);
      ss.push(s);
    }

    ss.forEach((s, i) => s.emit('licitar', { leilaoId: a.id, valor: valores[i] }));

    // 120 é sempre aceite (o valor atual nunca passa de 115), por isso é o estado final de todos
    await esperarCondicao(() => ss.every((s) => maximo.get(s) === 120));
    const l = await leilaoNaApi(a.id);
    assert.equal(l.licitacaoAtual.valor, 120);

    const bids = (await pedir('GET', `/auctions/${a.id}/bids`)).json;
    assert.equal(bids.length, l.numLicitacoes, 'o histórico bate com o contador atómico');
    const vistos = bids.map((b) => b.valor);
    assert.equal(new Set(vistos).size, vistos.length, 'não há duas licitações com o mesmo valor');
    assert.deepEqual(vistos, [...vistos].sort((x, y) => y - x));
    // Cada aceite tem de superar a anterior em, pelo menos, o incremento (5); a primeira, o preço base + incremento
    const cronologico = [...vistos].reverse();
    let anterior = 50;
    for (const v of cronologico) {
      assert.ok(v >= anterior + 5, `${v} não supera ${anterior} em pelo menos o incremento`);
      anterior = v;
    }
  });

  it('rajada de 10 compradores com valores diferentes: aceites = registadas e cada uma >= anterior + incremento', async () => {
    const a = await criarLeilao(); // base 50, incremento 5
    const compradores = [tasca];
    while (compradores.length < 10) compradores.push(await novoComprador());
    const valores = [55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
    const ss = [];
    const vistas = new Map(); // valores aceites que cada cliente recebeu
    let recusadas = 0;
    for (const c of compradores) {
      const s = await ligar(c.token);
      vistas.set(s, []);
      s.on('nova-licitacao', (n) => vistas.get(s).push(n.valor));
      s.on('recusada', () => { recusadas += 1; });
      await entrarNaSala(s, a.id);
      ss.push(s);
    }

    ss.forEach((s, i) => s.emit('licitar', { leilaoId: a.id, valor: valores[i] }));

    // 100 nunca é recusada (o valor atual nunca passa de 95), por isso é o estado final de todos
    await esperarCondicao(() => ss.every((s) => vistas.get(s).includes(100)), 10_000);
    await pausa(300);

    const l = await leilaoNaApi(a.id);
    const bids = (await pedir('GET', `/auctions/${a.id}/bids`)).json;
    assert.equal(l.licitacaoAtual.valor, 100);
    assert.equal(bids.length, l.numLicitacoes, 'o histórico bate com o contador atómico');
    assert.equal(bids.length + recusadas, 10, 'cada pedido foi aceite ou recusado, nenhum se perdeu');
    for (const s of ss) assert.equal(vistas.get(s).length, bids.length, 'todos os clientes viram as mesmas aceites');

    let anterior = 50;
    for (const v of bids.map((b) => b.valor).sort((x, y) => x - y)) {
      assert.ok(v >= anterior + 5, `${v} não supera ${anterior} em pelo menos o incremento`);
      anterior = v;
    }
  });
});

// ---------- fim do leilão ----------
describe('Leilões: fim', () => {
  it('termina sozinho: vencedor, encomenda criada e já não aceita licitações', { timeout: 60_000 }, async () => {
    const comLicitacao = await criarLeilao({ duracaoMinutos: 0.25, precoBase: 20, incremento: 1 }); // 15 s
    const semLicitacao = await criarLeilao({ duracaoMinutos: 0.25 });

    const s = await ligar(tasca.token);
    await entrarNaSala(s, comLicitacao.id);
    await entrarNaSala(s, semLicitacao.id);

    const p = esperar(s, 'nova-licitacao', 5000, (n) => n.leilaoId === comLicitacao.id);
    s.emit('licitar', { leilaoId: comLicitacao.id, valor: 21 });
    await p;

    const [fim1, fim2, ganho] = await Promise.all([
      esperar(s, 'terminado', 45_000, (t) => t.leilaoId === comLicitacao.id),
      esperar(s, 'terminado', 45_000, (t) => t.leilaoId === semLicitacao.id),
      esperar(s, 'leilao-ganho', 45_000, (g) => g.leilaoId === comLicitacao.id),
    ]);

    assert.equal(fim1.vencedor.id, tasca.id);
    assert.equal(fim1.valor, 21);
    assert.equal(fim2.vencedor, null);
    assert.equal(fim2.valor, null);
    assert.equal(ganho.valor, 21);
    assert.equal(typeof ganho.encomenda, 'string');

    assert.equal((await leilaoNaApi(comLicitacao.id)).estado, 'terminado');
    assert.equal((await leilaoNaApi(semLicitacao.id)).estado, 'terminado');

    // A encomenda do vencedor existe, uma só vez, com o valor da licitação
    const encomendas = (await pedir('GET', '/orders', { token: tasca.token })).json
      .filter((o) => o.linhas.some((l) => l.nome === comLicitacao.lote));
    assert.equal(encomendas.length, 1);
    assert.equal(encomendas[0].total, 21);
    assert.equal(encomendas[0].linhas[0].precoUnit, 21);
    assert.equal(encomendas[0].produtor.id, horta.id);
    assert.equal(encomendas[0].estado, 'pendente');

    // Depois do fim já ninguém licita
    assert.match(await licitarRecusada(s, comLicitacao.id, 30), /terminou/);
  });
});
