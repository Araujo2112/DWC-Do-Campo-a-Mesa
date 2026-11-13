// Testes de ponta a ponta: upload da imagem dos produtos
//
//   cd api
//   npm test
//
// Correm contra a API JÁ A CORRER, com o seed feito. Nunca os apontes à base de produção.
// Sem STORAGE_CONN as imagens ficam em api/uploads; com ela, no Azure Blob Storage.

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.API_URL || 'http://localhost:3000/api';
const SEED = { produtor: 'horta@exemplo.pt', produtor2: 'mel@exemplo.pt', comprador: 'tasca@exemplo.pt', password: 'password123' };
const unico = Date.now();

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(32)]);

async function pedir(metodo, caminho, { corpo, token, form } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
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

const ficheiro = (buffer, tipo = 'image/png', nome = 'foto.png', campo = 'imagem') => {
  const f = new FormData();
  f.append(campo, new Blob([buffer], { type: tipo }), nome);
  return f;
};

let horta, mel, tasca, produto;
const enviar = (token, id, form) => pedir('POST', `/products/${id}/imagem`, { token, form });

before(async () => {
  try {
    assert.equal((await fetch(BASE + '/health')).status, 200);
  } catch {
    throw new Error(`A API não responde em ${BASE}. Arranca-a com "npm run dev" (noutro terminal).`);
  }
  horta = await entrar(SEED.produtor);
  mel = await entrar(SEED.produtor2);
  tasca = await entrar(SEED.comprador);
  const r = await pedir('POST', '/products', {
    token: horta.token,
    corpo: { nome: `Produto imagem ${unico}`, categoria: 'Fruta', preco: 2, unidade: 'kg', stock: 5 },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  produto = r.json;
});

describe('Imagens: acesso', () => {
  it('sem token: 401; comprador: 403', async () => {
    assert.equal((await enviar(undefined, produto._id, ficheiro(PNG))).status, 401);
    assert.equal((await enviar(tasca.token, produto._id, ficheiro(PNG))).status, 403);
  });

  it('produto de outro produtor: 404 e a imagem não muda', async () => {
    assert.equal((await enviar(mel.token, produto._id, ficheiro(PNG))).status, 404);
    assert.equal((await pedir('GET', `/products/${produto._id}`)).json.imagemUrl, undefined);
  });

  it('id inválido: 400; produto inexistente: 404', async () => {
    assert.equal((await enviar(horta.token, 'abc', ficheiro(PNG))).status, 400);
    assert.equal((await enviar(horta.token, '507f1f77bcf86cd799439011', ficheiro(PNG))).status, 404);
  });

  it('produtor por validar: 403', async () => {
    const email = `img.${unico}@teste.pt`;
    const reg = await pedir('POST', '/auth/registo', {
      corpo: { nome: 'Sem validar', email, password: 'segredo123', papel: 'produtor', produtor: { nomeExploracao: 'Quinta Nova', localidade: 'Vila Nova' } },
    });
    assert.equal(reg.status, 201);
    const novo = await entrar(email, 'segredo123');
    assert.equal((await enviar(novo.token, produto._id, ficheiro(PNG))).status, 403);
  });
});

describe('Imagens: validação do ficheiro', () => {
  it('sem ficheiro: 400', async () => {
    assert.equal((await enviar(horta.token, produto._id, new FormData())).status, 400);
  });

  it('campo com outro nome: 400', async () => {
    assert.equal((await enviar(horta.token, produto._id, ficheiro(PNG, 'image/png', 'foto.png', 'foto'))).status, 400);
  });

  it('texto a fingir de PNG (mimetype e extensão enganam): 400', async () => {
    const r = await enviar(horta.token, produto._id, ficheiro(Buffer.from('isto não é uma imagem'), 'image/png', 'falso.png'));
    assert.equal(r.status, 400, JSON.stringify(r.json));
  });

  it('HTML a fingir de imagem: 400', async () => {
    const r = await enviar(horta.token, produto._id, ficheiro(Buffer.from('<script>alert(1)</script>'), 'image/jpeg', 'x.jpg'));
    assert.equal(r.status, 400);
  });

  it('mais de 5 MB: 413', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
    const r = await enviar(horta.token, produto._id, ficheiro(grande));
    assert.equal(r.status, 413, JSON.stringify(r.json));
  });

  it('depois de todos os erros o produto continua sem imagem', async () => {
    assert.equal((await pedir('GET', `/products/${produto._id}`)).json.imagemUrl, undefined);
  });
});

describe('Imagens: guardar e substituir', () => {
  let primeira;

  it('PNG válido: 200 com imagemUrl, o ficheiro abre-se e o produto fica com o URL', async () => {
    const r = await enviar(horta.token, produto._id, ficheiro(PNG, 'image/png', '../../etc/passwd.png'));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    primeira = r.json.imagemUrl;
    assert.equal(typeof primeira, 'string');
    assert.ok(!primeira.includes('passwd'), 'o nome do cliente nunca entra no URL');
    assert.match(primeira, /\.png$/);

    const img = await fetch(primeira);
    assert.equal(img.status, 200, `o URL da imagem não abre (${primeira})`);
    assert.equal(img.headers.get('content-type'), 'image/png');

    assert.equal((await pedir('GET', `/products/${produto._id}`)).json.imagemUrl, primeira);
    const lista = await pedir('GET', `/products?produtor=${horta.id}`);
    assert.equal(lista.json.find((p) => p._id === produto._id).imagemUrl, primeira);
  });

  it('o tipo vem do conteúdo: JPEG com mimetype errado é aceite como .jpg', async () => {
    const r = await enviar(horta.token, produto._id, ficheiro(JPG, 'application/octet-stream', 'x.bin'));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.match(r.json.imagemUrl, /\.jpg$/);
    assert.notEqual(r.json.imagemUrl, primeira, 'cada envio tem um nome novo');
  });

  it('WebP: 200', async () => {
    const r = await enviar(horta.token, produto._id, ficheiro(WEBP, 'image/webp', 'x.webp'));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.match(r.json.imagemUrl, /\.webp$/);
  });

  it('PUT do produto não mexe na imagem, mesmo que o corpo traga imagemUrl', async () => {
    const antes = (await pedir('GET', `/products/${produto._id}`)).json;
    const r = await pedir('PUT', `/products/${produto._id}`, {
      token: horta.token,
      corpo: { nome: antes.nome, categoria: 'Fruta', preco: 3, unidade: 'kg', stock: 5, imagemUrl: 'https://exemplo.pt/falso.png' },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.imagemUrl, antes.imagemUrl);
  });

  it('apagar o produto: 204', async () => {
    assert.equal((await pedir('DELETE', `/products/${produto._id}`, { token: horta.token })).status, 204);
  });
});
