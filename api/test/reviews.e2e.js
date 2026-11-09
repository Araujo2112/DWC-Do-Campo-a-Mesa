// Testes de ponta a ponta: avaliações, médias, denúncias e moderação
// Usa um produtor novo em cada execução, por isso as médias não dependem do que já está na base.

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const SEED = { admin: 'admin@exemplo.pt', password: 'password123' };
const INEXISTENTE = '0'.repeat(24);
const unico = Date.now();
let contador = 0;
const emailNovo = (prefixo) => `${prefixo}.${unico}.${++contador}@teste.pt`;

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

async function entrar(email, password) {
  const r = await pedir('POST', '/auth/login', { corpo: { email, password } });
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return { token: r.json.token, id: r.json.utilizador.id };
}

async function novoComprador(nome) {
  const email = emailNovo('comprador');
  const r = await pedir('POST', '/auth/registo', { corpo: { nome, email, password: 'segredo123' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return entrar(email, 'segredo123');
}

async function novoProdutorValidado(admin) {
  const email = emailNovo('produtor');
  const r = await pedir('POST', '/auth/registo', {
    corpo: {
      nome: 'Quinta das Avaliações',
      email,
      password: 'segredo123',
      papel: 'produtor',
      produtor: { nomeExploracao: 'Quinta das Avaliações', localidade: 'Valença' },
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const p = await entrar(email, 'segredo123');
  const v = await pedir('PATCH', `/admin/produtores/${p.id}/validacao`, { token: admin.token, corpo: { aprovado: true } });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  return p;
}

async function criarProduto(produtor, nome) {
  const r = await pedir('POST', '/products', {
    token: produtor.token,
    corpo: { nome, categoria: 'Fruta', preco: 2.5, unidade: 'kg', stock: 50 },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

async function encomendar(comprador, produtos) {
  const r = await pedir('POST', '/orders', {
    token: comprador.token,
    corpo: { linhas: produtos.map((p) => ({ produto: p._id, quantidade: 1 })) },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json[0];
}

async function entregar(produtor, encomenda) {
  for (const estado of ['confirmada', 'pronta', 'entregue']) {
    const r = await pedir('PATCH', `/orders/${encomenda.id}/estado`, { token: produtor.token, corpo: { estado } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
}

const avaliar = (comprador, corpo) => pedir('POST', '/reviews', { token: comprador.token, corpo });
const fila = async (admin) => (await pedir('GET', '/admin/reviews/denunciadas', { token: admin.token })).json;

let admin, quinta, kiwi, abobora, fora;
let ana, bia, cris;
let encPendente, enc1, enc2;
let revProdutor, revKiwiAna, revKiwiBia;

before(async () => {
  admin = await entrar(SEED.admin, SEED.password);
  quinta = await novoProdutorValidado(admin);
  [kiwi, abobora, fora] = [
    await criarProduto(quinta, 'Kiwi de teste'),
    await criarProduto(quinta, 'Abóbora de teste'),
    await criarProduto(quinta, 'Produto fora da encomenda'),
  ];
  [ana, bia, cris] = [await novoComprador('Ana'), await novoComprador('Bia'), await novoComprador('Cris')];

  encPendente = await encomendar(ana, [kiwi]);
  enc1 = await encomendar(ana, [kiwi, abobora]);
  enc2 = await encomendar(bia, [kiwi]);
  await entregar(quinta, enc1);
  await entregar(quinta, enc2);
});

describe('avaliações: criar', () => {
  it('sem token responde 401', async () => {
    const r = await pedir('POST', '/reviews', { corpo: { encomenda: enc1.id, classificacao: 4 } });
    assert.equal(r.status, 401);
  });

  it('o produtor não avalia (403)', async () => {
    const r = await pedir('POST', '/reviews', { token: quinta.token, corpo: { encomenda: enc1.id, classificacao: 4 } });
    assert.equal(r.status, 403);
  });

  it('dados inválidos respondem 400', async () => {
    const maus = [
      { encomenda: enc1.id, classificacao: 0 },
      { encomenda: enc1.id, classificacao: 6 },
      { encomenda: enc1.id, classificacao: 3.5 },
      { encomenda: enc1.id, classificacao: '5' },
      { encomenda: enc1.id },
      { encomenda: enc1.id, classificacao: 4, comentario: 'x'.repeat(501) },
      { encomenda: enc1.id, classificacao: 4, comentario: { $ne: 1 } },
      { encomenda: 'abc', classificacao: 4 },
      { classificacao: 4 },
      { encomenda: enc1.id, produto: 'abc', classificacao: 4 },
    ];
    for (const corpo of maus) {
      const r = await avaliar(ana, corpo);
      assert.equal(r.status, 400, `esperava 400 para ${JSON.stringify(corpo)}, veio ${r.status}`);
    }
  });

  it('encomenda ainda não entregue responde 409', async () => {
    const r = await avaliar(ana, { encomenda: encPendente.id, classificacao: 5 });
    assert.equal(r.status, 409);
  });

  it('encomenda de outro comprador responde 404', async () => {
    const r = await avaliar(bia, { encomenda: enc1.id, classificacao: 5 });
    assert.equal(r.status, 404);
  });

  it('encomenda inexistente responde 404', async () => {
    const r = await avaliar(ana, { encomenda: INEXISTENTE, classificacao: 5 });
    assert.equal(r.status, 404);
  });

  it('produto que não está na encomenda responde 400', async () => {
    const r = await avaliar(ana, { encomenda: enc1.id, produto: fora._id, classificacao: 5 });
    assert.equal(r.status, 400);
  });

  it('avalia o produtor: 201 com Location', async () => {
    const r = await avaliar(ana, { encomenda: enc1.id, classificacao: 4, comentario: '  Boa horta  ' });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.produto, null);
    assert.equal(r.json.comentario, 'Boa horta');
    assert.equal(r.headers.get('location'), `/api/reviews/${r.json.id}`);
    revProdutor = r.json;
  });

  it('não se avalia duas vezes o produtor na mesma encomenda (409)', async () => {
    const r = await avaliar(ana, { encomenda: enc1.id, classificacao: 1 });
    assert.equal(r.status, 409);
  });

  it('avalia cada produto da encomenda e não repete (409)', async () => {
    const k = await avaliar(ana, { encomenda: enc1.id, produto: kiwi._id, classificacao: 5, comentario: 'Doce' });
    assert.equal(k.status, 201, JSON.stringify(k.json));
    revKiwiAna = k.json;

    const a = await avaliar(ana, { encomenda: enc1.id, produto: abobora._id, classificacao: 3 });
    assert.equal(a.status, 201, JSON.stringify(a.json));

    const repetida = await avaliar(ana, { encomenda: enc1.id, produto: kiwi._id, classificacao: 2 });
    assert.equal(repetida.status, 409);
  });

  it('duas avaliações iguais em simultâneo: só uma passa', async () => {
    const pedidos = await Promise.all([1, 2, 3].map(() => avaliar(bia, { encomenda: enc2.id, classificacao: 5 })));
    const estados = pedidos.map((p) => p.status).sort();
    assert.deepEqual(estados, [201, 409, 409]);
  });

  it('o mesmo produto noutra encomenda (outro comprador) também se avalia', async () => {
    const r = await avaliar(bia, { encomenda: enc2.id, produto: kiwi._id, classificacao: 3 });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    revKiwiBia = r.json;
  });
});

describe('avaliações: listagens e médias', () => {
  it('GET /reviews sem filtro, com os dois filtros ou com id inválido responde 400', async () => {
    assert.equal((await pedir('GET', '/reviews')).status, 400);
    assert.equal((await pedir('GET', `/reviews?produtor=${quinta.id}&produto=${kiwi._id}`)).status, 400);
    assert.equal((await pedir('GET', '/reviews?produtor=abc')).status, 400);
    assert.equal((await pedir('GET', '/reviews?produto[$ne]=x')).status, 400);
  });

  it('por produtor só devolve as avaliações ao produtor, sem emails', async () => {
    const r = await pedir('GET', `/reviews?produtor=${quinta.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.length, 2); // a da Ana e a da Bia
    assert.ok(r.json.every((x) => x.produto === null));
    assert.ok(!JSON.stringify(r.json).includes('@'));
    assert.ok(r.json.some((x) => x.autor.nome === 'Ana' && x.classificacao === 4));
  });

  it('por produto devolve só as desse produto', async () => {
    const r = await pedir('GET', `/reviews?produto=${kiwi._id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.length, 2);
    assert.ok(r.json.every((x) => x.produto === kiwi._id));
  });

  it('GET /reviews/:id: 200, 400 e 404', async () => {
    assert.equal((await pedir('GET', `/reviews/${revProdutor.id}`)).status, 200);
    assert.equal((await pedir('GET', '/reviews/abc')).status, 400);
    assert.equal((await pedir('GET', `/reviews/${INEXISTENTE}`)).status, 404);
  });

  it('a média do produtor só conta as avaliações ao produtor', async () => {
    const r = await pedir('GET', `/producers/${quinta.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.numAvaliacoes, 2);
    assert.equal(r.json.avaliacaoMedia, 4.5); // (4 + 5) / 2
    const k = r.json.produtos.find((p) => p._id === kiwi._id);
    assert.equal(k.avaliacaoMedia, 4); // (5 + 3) / 2
    assert.equal(k.numAvaliacoes, 2);
    const a = r.json.produtos.find((p) => p._id === abobora._id);
    assert.equal(a.avaliacaoMedia, 3);
    assert.equal(r.json.produtos.find((p) => p._id === fora._id).avaliacaoMedia, null);
  });

  it('os produtos trazem a média no catálogo e no detalhe', async () => {
    const lista = await pedir('GET', `/products?produtor=${quinta.id}`);
    const k = lista.json.find((p) => p._id === kiwi._id);
    assert.equal(k.avaliacaoMedia, 4);
    assert.equal(k.numAvaliacoes, 2);

    const um = await pedir('GET', `/products/${kiwi._id}`);
    assert.equal(um.json.avaliacaoMedia, 4);
    assert.equal(um.json.numAvaliacoes, 2);
  });

  it('GET /reviews/minhas: só do comprador, com autenticação', async () => {
    assert.equal((await pedir('GET', '/reviews/minhas')).status, 401);
    assert.equal((await pedir('GET', '/reviews/minhas', { token: quinta.token })).status, 403);

    const r = await pedir('GET', '/reviews/minhas', { token: ana.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.length, 3);
    assert.ok(r.json.every((x) => x.encomenda === enc1.id));
  });
});

describe('avaliações: denúncias e moderação', () => {
  it('denunciar exige sessão e um id válido e existente', async () => {
    assert.equal((await pedir('POST', `/reviews/${revKiwiAna.id}/denuncia`)).status, 401);
    assert.equal((await pedir('POST', '/reviews/abc/denuncia', { token: bia.token })).status, 400);
    assert.equal((await pedir('POST', `/reviews/${INEXISTENTE}/denuncia`, { token: bia.token })).status, 404);
  });

  it('o autor não denuncia a própria avaliação (403)', async () => {
    const r = await pedir('POST', `/reviews/${revKiwiAna.id}/denuncia`, { token: ana.token });
    assert.equal(r.status, 403);
  });

  it('denunciar: 204; repetir o mesmo utilizador: 409; outro utilizador: 204', async () => {
    assert.equal((await pedir('POST', `/reviews/${revKiwiAna.id}/denuncia`, { token: bia.token })).status, 204);
    assert.equal((await pedir('POST', `/reviews/${revKiwiAna.id}/denuncia`, { token: bia.token })).status, 409);
    assert.equal((await pedir('POST', `/reviews/${revKiwiAna.id}/denuncia`, { token: quinta.token })).status, 204);
  });

  it('denúncias simultâneas do mesmo utilizador contam uma só vez', async () => {
    const pedidos = await Promise.all([1, 2, 3].map(() =>
      pedir('POST', `/reviews/${revProdutor.id}/denuncia`, { token: cris.token })));
    assert.deepEqual(pedidos.map((p) => p.status).sort(), [204, 409, 409]);
  });

  it('a fila do admin mostra a avaliação com o nº de denúncias, sem emails', async () => {
    const lista = await fila(admin);
    const item = lista.find((x) => x.id === revKiwiAna.id);
    assert.ok(item, 'a avaliação denunciada devia estar na fila');
    assert.equal(item.numDenuncias, 2);
    assert.equal(item.autor, 'Ana');
    assert.equal(item.produto, 'Kiwi de teste');
    assert.equal(lista.find((x) => x.id === revProdutor.id).numDenuncias, 1);
    assert.ok(!JSON.stringify(lista).includes('@'));
  });

  it('só o admin vê a fila e modera', async () => {
    assert.equal((await pedir('GET', '/admin/reviews/denunciadas')).status, 401);
    assert.equal((await pedir('GET', '/admin/reviews/denunciadas', { token: bia.token })).status, 403);
    const r = await pedir('PATCH', `/admin/reviews/${revKiwiAna.id}`, {
      token: bia.token, corpo: { acao: 'ocultar' },
    });
    assert.equal(r.status, 403);
  });

  it('denunciada continua visível até o admin decidir', async () => {
    const r = await pedir('GET', `/reviews?produto=${kiwi._id}`);
    assert.equal(r.json.length, 2);
  });

  it('moderar: ação inválida 400, id inválido 400, inexistente 404', async () => {
    const p = (id, corpo) => pedir('PATCH', `/admin/reviews/${id}`, { token: admin.token, corpo });
    assert.equal((await p(revKiwiAna.id, { acao: 'apagar' })).status, 400);
    assert.equal((await p(revKiwiAna.id, {})).status, 400);
    assert.equal((await p('abc', { acao: 'manter' })).status, 400);
    assert.equal((await p(INEXISTENTE, { acao: 'manter' })).status, 404);
  });

  it('manter: fica revista e sai da fila; manter outra vez dá 409', async () => {
    const m = await pedir('PATCH', `/admin/reviews/${revProdutor.id}`, { token: admin.token, corpo: { acao: 'manter' } });
    assert.equal(m.status, 200);
    assert.equal(m.json.moderacao, 'revista');
    assert.ok(!(await fila(admin)).some((x) => x.id === revProdutor.id));

    const outra = await pedir('PATCH', `/admin/reviews/${revProdutor.id}`, { token: admin.token, corpo: { acao: 'manter' } });
    assert.equal(outra.status, 409);
  });

  it('nova denúncia a uma avaliação revista não a volta a pôr na fila', async () => {
    const r = await pedir('POST', `/reviews/${revProdutor.id}/denuncia`, { token: bia.token });
    assert.equal(r.status, 204);
    assert.ok(!(await fila(admin)).some((x) => x.id === revProdutor.id));
    assert.equal((await pedir('GET', `/reviews/${revProdutor.id}`)).status, 200);
  });

  it('ocultar: sai das listagens, da média e do detalhe', async () => {
    const o = await pedir('PATCH', `/admin/reviews/${revKiwiAna.id}`, { token: admin.token, corpo: { acao: 'ocultar' } });
    assert.equal(o.status, 200);
    assert.equal(o.json.moderacao, 'oculta');

    const lista = await pedir('GET', `/reviews?produto=${kiwi._id}`);
    assert.deepEqual(lista.json.map((x) => x.id), [revKiwiBia.id]);

    const produto = await pedir('GET', `/products/${kiwi._id}`);
    assert.equal(produto.json.avaliacaoMedia, 3); // só ficou a da Bia
    assert.equal(produto.json.numAvaliacoes, 1);

    assert.equal((await pedir('GET', `/reviews/${revKiwiAna.id}`)).status, 404);
    assert.ok(!(await fila(admin)).some((x) => x.id === revKiwiAna.id));
  });

  it('uma avaliação oculta já não se denuncia (404) nem se oculta outra vez (409)', async () => {
    assert.equal((await pedir('POST', `/reviews/${revKiwiAna.id}/denuncia`, { token: cris.token })).status, 404);
    const o = await pedir('PATCH', `/admin/reviews/${revKiwiAna.id}`, { token: admin.token, corpo: { acao: 'ocultar' } });
    assert.equal(o.status, 409);
  });

  it('a autora continua a ver a avaliação oculta em /minhas e não pode repeti-la', async () => {
    const minhas = await pedir('GET', '/reviews/minhas', { token: ana.token });
    assert.ok(minhas.json.some((x) => x.id === revKiwiAna.id));
    const r = await avaliar(ana, { encomenda: enc1.id, produto: kiwi._id, classificacao: 5 });
    assert.equal(r.status, 409);
  });
});
