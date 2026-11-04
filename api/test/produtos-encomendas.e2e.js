// Testes de ponta a ponta: produtos, produtores e encomendas

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const SEED = {
  comprador: 'tasca@exemplo.pt',
  produtor: 'horta@exemplo.pt',
  produtor2: 'mel@exemplo.pt',
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

// Faz login e devolve { token, id }
async function entrar(email, password = SEED.password) {
  const r = await pedir('POST', '/auth/login', { corpo: { email, password } });
  assert.equal(r.status, 200, `Login de ${email} falhou (${r.status}). Já fizeste "npm run seed"?`);
  return { token: r.json.token, id: r.json.utilizador.id };
}

async function novoComprador() {
  const email = emailNovo('comprador');
  const r = await pedir('POST', '/auth/registo', { corpo: { nome: 'Outro Comprador', email, password: 'segredo123' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return entrar(email, 'segredo123');
}

// Produtor novo, por validar: devolve o id
async function novoProdutorPorValidar() {
  const r = await pedir('POST', '/auth/registo', {
    corpo: {
      nome: 'Quinta Pendente',
      email: emailNovo('pendente'),
      password: 'segredo123',
      papel: 'produtor',
      produtor: { nomeExploracao: 'Quinta Pendente', localidade: 'Valença' },
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.id;
}

let horta, mel, tasca;
const produtosCriados = []; // para apagar no fim

async function criarProduto(dono, extra = {}) {
  const r = await pedir('POST', '/products', {
    token: dono.token,
    corpo: { nome: `Teste ${++contador}`, categoria: 'Fruta', preco: 2.5, unidade: 'kg', stock: 5, ...extra },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  produtosCriados.push({ id: r.json._id, token: dono.token });
  return r.json;
}

const encomendar = (token, linhas, entrega) =>
  pedir('POST', '/orders', { token, corpo: { linhas, ...(entrega ? { entrega } : {}) } });

const stockDe = async (produto) => (await pedir('GET', `/products/${produto._id}`)).json.stock;

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

after(async () => {
  for (const p of produtosCriados) await pedir('DELETE', `/products/${p.id}`, { token: p.token });
});

// ---------- produtos: criar, ler, atualizar, apagar ----------
describe('Produtos: CRUD', () => {
  it('POST válido: 201, Location e dono = utilizador autenticado (ignora "produtor" do corpo)', async () => {
    const r = await pedir('POST', '/products', {
      token: horta.token,
      corpo: { nome: 'Teste POST', categoria: 'Fruta', preco: 3, produtor: mel.id },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    produtosCriados.push({ id: r.json._id, token: horta.token });
    assert.equal(r.headers.get('location'), `/api/products/${r.json._id}`);
    assert.equal(String(r.json.produtor), horta.id, 'o dono tem de vir do token, não do corpo');
    assert.equal(r.json.stock, 0);
    assert.equal(r.json.unidade, 'kg');
  });

  const base = { nome: 'Teste inválido', categoria: 'Fruta', preco: 1 };
  for (const [descricao, corpo] of [
    ['sem nome', { categoria: 'Fruta', preco: 1 }],
    ['categoria inválida', { ...base, categoria: 'Carros' }],
    ['preço negativo', { ...base, preco: -1 }],
    ['preço em texto', { ...base, preco: '2' }],
    ['stock decimal', { ...base, stock: 1.5 }],
    ['época inválida', { ...base, epocas: ['Monção'] }],
    ['biologico em texto', { ...base, biologico: 'sim' }],
  ]) {
    it(`POST ${descricao}: 400`, async () => {
      const r = await pedir('POST', '/products', { token: horta.token, corpo });
      assert.equal(r.status, 400, JSON.stringify(r.json));
    });
  }

  it('GET /:id: 200 com o produtor (nome)', async () => {
    const p = await criarProduto(horta);
    const r = await pedir('GET', `/products/${p._id}`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json._id, p._id);
    assert.ok(r.json.produtor.nome);
  });

  it('GET /:id com id inválido: 400', async () => {
    assert.equal((await pedir('GET', '/products/isto-nao-e-um-id')).status, 400);
  });

  it('GET /:id que não existe: 404', async () => {
    assert.equal((await pedir('GET', '/products/000000000000000000000000')).status, 404);
  });

  it('PUT do dono: 200 e os dados mudam', async () => {
    const p = await criarProduto(horta);
    const r = await pedir('PUT', `/products/${p._id}`, {
      token: horta.token,
      corpo: { nome: 'Nome novo', categoria: 'Fruta', preco: 4, stock: 7 },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.nome, 'Nome novo');
    assert.equal(r.json.preco, 4);
    assert.equal(r.json.stock, 7);
  });

  it('PUT com corpo inválido: 400', async () => {
    const p = await criarProduto(horta);
    const r = await pedir('PUT', `/products/${p._id}`, { token: horta.token, corpo: { nome: 'X', categoria: 'Fruta', preco: -5 } });
    assert.equal(r.status, 400);
  });

  it('PUT por outro produtor: 404 e o produto não muda', async () => {
    const p = await criarProduto(horta);
    const r = await pedir('PUT', `/products/${p._id}`, {
      token: mel.token,
      corpo: { nome: 'Roubado', categoria: 'Fruta', preco: 1 },
    });
    assert.equal(r.status, 404);
    const depois = await pedir('GET', `/products/${p._id}`);
    assert.equal(depois.json.nome, p.nome);
  });

  it('DELETE do dono: 204 e deixa de existir', async () => {
    const p = await criarProduto(horta);
    assert.equal((await pedir('DELETE', `/products/${p._id}`, { token: horta.token })).status, 204);
    assert.equal((await pedir('GET', `/products/${p._id}`)).status, 404);
  });

  it('DELETE por outro produtor: 404 e o produto continua a existir', async () => {
    const p = await criarProduto(horta);
    assert.equal((await pedir('DELETE', `/products/${p._id}`, { token: mel.token })).status, 404);
    assert.equal((await pedir('GET', `/products/${p._id}`)).status, 200);
  });
});

// ---------- produtos: filtros e ordenação ----------
describe('Produtos: filtros e ordenação', () => {
  it('ordenar=preco_asc: preços por ordem crescente', async () => {
    const r = await pedir('GET', '/products?ordenar=preco_asc');
    assert.equal(r.status, 200);
    const precos = r.json.map((p) => p.preco);
    assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
  });

  it('ordenar=preco_desc: preços por ordem decrescente', async () => {
    const r = await pedir('GET', '/products?ordenar=preco_desc');
    const precos = r.json.map((p) => p.preco);
    assert.deepEqual(precos, [...precos].sort((a, b) => b - a));
  });

  it('ordenar inválido: 400', async () => {
    assert.equal((await pedir('GET', '/products?ordenar=aleatorio')).status, 400);
  });

  it('produtor=<id>: só produtos desse produtor', async () => {
    const r = await pedir('GET', `/products?produtor=${mel.id}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.length > 0, 'o seed tem produtos do Mel do Soajo');
    assert.ok(r.json.every((p) => String(p.produtor._id) === mel.id));
  });

  it('produtor inválido: 400', async () => {
    assert.equal((await pedir('GET', '/products?produtor=abc')).status, 400);
  });

  it('epoca=Inverno: só produtos dessa época', async () => {
    const r = await pedir('GET', '/products?epoca=Inverno');
    assert.equal(r.status, 200);
    assert.ok(r.json.length > 0);
    assert.ok(r.json.every((p) => p.epocas.includes('Inverno')));
  });

  it('epoca desconhecida: 400', async () => {
    assert.equal((await pedir('GET', '/products?epoca=Natal')).status, 400);
  });

  it('precoMin=5: só produtos com preço >= 5', async () => {
    const r = await pedir('GET', '/products?precoMin=5');
    assert.equal(r.status, 200);
    assert.ok(r.json.length > 0);
    assert.ok(r.json.every((p) => p.preco >= 5));
  });

  it('precoMin que não é número: 400', async () => {
    assert.equal((await pedir('GET', '/products?precoMin=abc')).status, 400);
  });
});

// ---------- produtores ----------
describe('Produtores: páginas públicas', () => {
  it('GET /producers/:id: 200 com produtor, produtos e avaliação, sem email', async () => {
    const r = await pedir('GET', `/producers/${horta.id}`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.produtor.id, horta.id);
    assert.ok(r.json.produtor.nomeExploracao);
    assert.ok(Array.isArray(r.json.produtos) && r.json.produtos.length > 0);
    assert.ok(r.json.produtos.every((p) => String(p.produtor) === horta.id));
    assert.ok(r.json.avaliacaoMedia === null || typeof r.json.avaliacaoMedia === 'number');
    assert.ok(!JSON.stringify(r.json).includes('email'), 'a página pública não pode expor o email');
  });

  it('produtor por validar: 404', async () => {
    const id = await novoProdutorPorValidar();
    assert.equal((await pedir('GET', `/producers/${id}`)).status, 404);
  });

  it('id de um comprador: 404', async () => {
    assert.equal((await pedir('GET', `/producers/${tasca.id}`)).status, 404);
  });

  it('id inválido: 400', async () => {
    assert.equal((await pedir('GET', '/producers/abc')).status, 400);
  });

  it('GET /producers: só validados e sem email', async () => {
    const pendente = await novoProdutorPorValidar();
    const r = await pedir('GET', '/producers');
    assert.equal(r.status, 200);
    assert.ok(r.json.some((p) => p.id === horta.id));
    assert.ok(!r.json.some((p) => p.id === pendente), 'um produtor por validar não pode aparecer');
    assert.ok(!JSON.stringify(r.json).includes('email'));
  });

  it('GET /producers?localidade=Ponte: inclui a Horta (Ponte de Lima) e não o Mel (Arcos)', async () => {
    const r = await pedir('GET', '/producers?localidade=Ponte');
    assert.equal(r.status, 200);
    assert.ok(r.json.some((p) => p.id === horta.id));
    assert.ok(!r.json.some((p) => p.id === mel.id));
  });
});

// ---------- encomendas: criar ----------
describe('Encomendas: criar (checkout)', () => {
  let base; // produto com muito stock para os testes de validação

  before(async () => { base = await criarProduto(horta, { stock: 100 }); });

  it('sem token: 401', async () => {
    assert.equal((await encomendar(undefined, [{ produto: base._id, quantidade: 1 }])).status, 401);
  });

  it('produtor não encomenda: 403', async () => {
    assert.equal((await encomendar(horta.token, [{ produto: base._id, quantidade: 1 }])).status, 403);
  });

  it('201: usa o preço da BD (ignora o do cliente), calcula o total e desconta o stock', async () => {
    const p = await criarProduto(horta, { preco: 2.5, stock: 5 });
    const r = await encomendar(tasca.token, [{ produto: p._id, quantidade: 2, precoUnit: 0.01 }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.length, 1);
    const o = r.json[0];
    assert.equal(o.total, 5);
    assert.equal(o.linhas[0].precoUnit, 2.5, 'o preço tem de vir da base de dados');
    assert.equal(o.linhas[0].nome, p.nome);
    assert.equal(o.estado, 'pendente');
    assert.equal(o.entrega.tipo, 'levantamento');
    assert.equal(r.headers.get('location'), `/api/orders/${o.id}`);
    assert.equal(await stockDe(p), 3);
  });

  it('linhas repetidas do mesmo produto juntam-se numa só', async () => {
    const p = await criarProduto(horta, { stock: 10 });
    const r = await encomendar(tasca.token, [
      { produto: p._id, quantidade: 1 },
      { produto: p._id, quantidade: 2 },
    ]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json[0].linhas.length, 1);
    assert.equal(r.json[0].linhas[0].quantidade, 3);
    assert.equal(await stockDe(p), 7);
  });

  it('produtos de dois produtores: uma encomenda por produtor', async () => {
    const p1 = await criarProduto(horta);
    const p2 = await criarProduto(mel);
    const r = await encomendar(tasca.token, [
      { produto: p1._id, quantidade: 1 },
      { produto: p2._id, quantidade: 1 },
    ]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.length, 2);
    assert.deepEqual(r.json.map((o) => o.produtor.id).sort(), [horta.id, mel.id].sort());
    assert.equal(r.headers.get('location'), null, 'só há Location quando é criada uma encomenda');
  });

  it('entrega com morada: 201 e a morada fica guardada', async () => {
    const p = await criarProduto(horta);
    const r = await encomendar(tasca.token, [{ produto: p._id, quantidade: 1 }], { tipo: 'entrega', morada: 'Rua da Ribeira 14' });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json[0].entrega.tipo, 'entrega');
    assert.equal(r.json[0].entrega.morada, 'Rua da Ribeira 14');
  });

  it('stock insuficiente: 409 e o stock não muda', async () => {
    const p = await criarProduto(horta, { stock: 2 });
    const r = await encomendar(tasca.token, [{ produto: p._id, quantidade: 3 }]);
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(await stockDe(p), 2);
  });

  it('se uma linha falha, o stock das outras volta ao que era', async () => {
    const p1 = await criarProduto(horta, { stock: 5 });
    const p2 = await criarProduto(horta, { stock: 1 });
    const r = await encomendar(tasca.token, [
      { produto: p1._id, quantidade: 1 },
      { produto: p2._id, quantidade: 2 },
    ]);
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(await stockDe(p1), 5, 'o stock do produto bom tem de ser devolvido');
    assert.equal(await stockDe(p2), 1);
  });

  it('pedidos simultâneos: com stock 2 e 5 pedidos de 1 unidade, só 2 passam e o stock nunca fica negativo', async () => {
    const p = await criarProduto(horta, { stock: 2 });
    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => encomendar(tasca.token, [{ produto: p._id, quantidade: 1 }]))
    );
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 201, 409, 409, 409]);
    assert.equal(await stockDe(p), 0);
  });

  for (const [descricao, linhas, entrega] of [
    ['sem linhas', [], undefined],
    ['linhas que não é lista', 'abc', undefined],
    ['quantidade 0', [{ produto: 'BASE', quantidade: 0 }], undefined],
    ['quantidade negativa', [{ produto: 'BASE', quantidade: -1 }], undefined],
    ['quantidade decimal', [{ produto: 'BASE', quantidade: 1.5 }], undefined],
    ['quantidade em texto', [{ produto: 'BASE', quantidade: '2' }], undefined],
    ['quantidade enorme', [{ produto: 'BASE', quantidade: 100000 }], undefined],
    ['id de produto inválido', [{ produto: 'abc', quantidade: 1 }], undefined],
    ['produto que não existe', [{ produto: '000000000000000000000000', quantidade: 1 }], undefined],
    ['entrega sem morada', [{ produto: 'BASE', quantidade: 1 }], { tipo: 'entrega' }],
    ['tipo de entrega inválido', [{ produto: 'BASE', quantidade: 1 }], { tipo: 'drone' }],
    ['entrega que não é objeto', [{ produto: 'BASE', quantidade: 1 }], 'rapida'],
  ]) {
    it(`${descricao}: 400`, async () => {
      const certas = Array.isArray(linhas)
        ? linhas.map((l) => (l.produto === 'BASE' ? { ...l, produto: base._id } : l))
        : linhas;
      const r = await pedir('POST', '/orders', { token: tasca.token, corpo: { linhas: certas, entrega } });
      assert.equal(r.status, 400, JSON.stringify(r.json));
    });
  }

  it('o stock do produto base não mudou com os pedidos inválidos', async () => {
    assert.equal(await stockDe(base), 100);
  });
});

// ---------- encomendas: consultar ----------
describe('Encomendas: consultar', () => {
  let o;
  let outroComprador;

  before(async () => {
    const p = await criarProduto(horta, { stock: 10 });
    const r = await encomendar(tasca.token, [{ produto: p._id, quantidade: 1 }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    o = r.json[0];
    outroComprador = await novoComprador();
  });

  it('GET /orders sem token: 401', async () => {
    assert.equal((await pedir('GET', '/orders')).status, 401);
  });

  it('o comprador vê a sua encomenda; outro comprador não', async () => {
    const meu = await pedir('GET', '/orders', { token: tasca.token });
    assert.equal(meu.status, 200);
    assert.ok(meu.json.some((x) => x.id === o.id));
    const outro = await pedir('GET', '/orders', { token: outroComprador.token });
    assert.ok(!outro.json.some((x) => x.id === o.id));
  });

  it('o produtor dono vê a encomenda; outro produtor não', async () => {
    const dono = await pedir('GET', '/orders', { token: horta.token });
    assert.ok(dono.json.some((x) => x.id === o.id));
    const outro = await pedir('GET', '/orders', { token: mel.token });
    assert.ok(!outro.json.some((x) => x.id === o.id));
  });

  it('GET /orders/:id: 200 para o comprador, o produtor dono e o admin', async () => {
    const admin = await entrar(SEED.admin);
    for (const token of [tasca.token, horta.token, admin.token]) {
      const r = await pedir('GET', `/orders/${o.id}`, { token });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.id, o.id);
    }
  });

  it('GET /orders/:id: 404 para outro comprador e para outro produtor', async () => {
    assert.equal((await pedir('GET', `/orders/${o.id}`, { token: outroComprador.token })).status, 404);
    assert.equal((await pedir('GET', `/orders/${o.id}`, { token: mel.token })).status, 404);
  });

  it('GET /orders/:id sem token: 401; id inválido: 400; inexistente: 404', async () => {
    assert.equal((await pedir('GET', `/orders/${o.id}`)).status, 401);
    assert.equal((await pedir('GET', '/orders/abc', { token: tasca.token })).status, 400);
    assert.equal((await pedir('GET', '/orders/000000000000000000000000', { token: tasca.token })).status, 404);
  });
});

// ---------- encomendas: mudar o estado ----------
describe('Encomendas: PATCH /orders/:id/estado', () => {
  let o;

  before(async () => {
    const p = await criarProduto(horta, { stock: 10 });
    const r = await encomendar(tasca.token, [{ produto: p._id, quantidade: 1 }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    o = r.json[0];
  });

  const mudar = (token, estado) => pedir('PATCH', `/orders/${o.id}/estado`, { token, corpo: { estado } });

  it('sem token: 401', async () => {
    assert.equal((await mudar(undefined, 'confirmada')).status, 401);
  });

  it('comprador: 403', async () => {
    assert.equal((await mudar(tasca.token, 'confirmada')).status, 403);
  });

  it('estado inválido: 400', async () => {
    assert.equal((await mudar(horta.token, 'enviada')).status, 400);
  });

  it('outro produtor: 404', async () => {
    assert.equal((await mudar(mel.token, 'confirmada')).status, 404);
  });

  it('saltar uma etapa (pendente -> pronta): 409', async () => {
    assert.equal((await mudar(horta.token, 'pronta')).status, 409);
  });

  // Os testes seguintes dependem da ordem: fazem avançar a mesma encomenda.
  it('pendente -> confirmada: 200', async () => {
    const r = await mudar(horta.token, 'confirmada');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.estado, 'confirmada');
  });

  it('recuar (confirmada -> pendente): 409', async () => {
    assert.equal((await mudar(horta.token, 'pendente')).status, 409);
  });

  it('confirmada -> pronta -> entregue: 200 e 200', async () => {
    assert.equal((await mudar(horta.token, 'pronta')).status, 200);
    const r = await mudar(horta.token, 'entregue');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.estado, 'entregue');
  });

  it('depois de entregue já não muda: 409', async () => {
    assert.equal((await mudar(horta.token, 'entregue')).status, 409);
  });

  it('o comprador vê o novo estado', async () => {
    const r = await pedir('GET', `/orders/${o.id}`, { token: tasca.token });
    assert.equal(r.json.estado, 'entregue');
  });
});