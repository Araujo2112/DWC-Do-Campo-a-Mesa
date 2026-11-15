// Dados de demonstração: npm run seed   (APAGA as coleções antes de inserir)
// Logins (password: password123): admin@exemplo.pt, horta@exemplo.pt, mel@exemplo.pt, tasca@exemplo.pt
// e ainda vinhos@, queijo@, pao@ (produtores), pendente@ (por validar), maria@, joao@, ana@, pedro@, ines@, beiral@, praca@ (compradores)
// Os produtores são fictícios; os produtos, as castas, as localidades e os preços são os típicos do Alto Minho.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Notificacao = require('../models/Notificacao');
const { codigo, euro } = require('../services/notificacoes');

const HORA = 3600 * 1000;
const DIA = 24 * HORA;
const arredondar = (v) => Math.round(v * 100) / 100;

// [chave, produtor, nome, categoria, preço, unidade, stock, bio, épocas]
const PRODUTOS = [
  ['kiwi', 'horta', 'Kiwi Hayward', 'Fruta', 2.4, 'kg', 300, true, ['Outono', 'Inverno']],
  ['castanha', 'horta', 'Castanha', 'Fruta', 6.5, 'kg', 90, false, ['Outono']],
  ['marmelo', 'horta', 'Marmelo', 'Fruta', 2.6, 'kg', 45, false, ['Outono']],
  ['abobora', 'horta', 'Abóbora-menina', 'Hortícolas', 1.2, 'kg', 80, false, ['Outono']],
  ['couve', 'horta', 'Couve-galega', 'Hortícolas', 1.5, 'molho', 40, true, ['Outono', 'Inverno']],
  ['grelos', 'horta', 'Grelos', 'Hortícolas', 1.8, 'molho', 35, false, ['Inverno']],
  ['urze', 'mel', 'Mel de urze', 'Mel', 7.5, '500 g', 38, false, ['Outono', 'Inverno']],
  ['castanheiro', 'mel', 'Mel de castanheiro', 'Mel', 7.0, '500 g', 21, false, ['Verão', 'Outono']],
  ['rosmaninho', 'mel', 'Mel de rosmaninho', 'Mel', 8.0, '500 g', 6, false, ['Primavera', 'Verão']],
  ['alvarinho', 'vinhos', 'Alvarinho 2025', 'Vinho', 9.5, 'garrafa', 120, false, ['Primavera', 'Verão']],
  ['reserva', 'vinhos', 'Alvarinho Reserva 2024', 'Vinho', 14.0, 'garrafa', 60, false, ['Outono', 'Inverno']],
  ['trajadura', 'vinhos', 'Alvarinho e Trajadura 2025', 'Vinho', 6.9, 'garrafa', 200, false, ['Primavera', 'Verão']],
  ['espumante', 'vinhos', 'Espumante de Alvarinho', 'Vinho', 13.5, 'garrafa', 18, false, ['Inverno']],
  ['cabra', 'queijo', 'Queijo de cabra curado', 'Queijo', 7.5, '300 g', 25, false, ['Outono', 'Inverno']],
  ['amanteigado', 'queijo', 'Queijo de cabra amanteigado', 'Queijo', 8.9, '300 g', 12, false, ['Inverno', 'Primavera']],
  ['fresco', 'queijo', 'Queijo fresco de cabra', 'Queijo', 3.2, '200 g', 50, false, ['Primavera', 'Verão']],
  ['requeijao', 'queijo', 'Requeijão', 'Queijo', 3.6, '250 g', 4, false, []],
  ['broa', 'pao', 'Broa de milho', 'Padaria', 3.5, 'unid.', 40, false, []],
  ['centeio', 'pao', 'Pão de centeio', 'Padaria', 2.8, 'unid.', 30, false, []],
  ['lenha', 'pao', 'Pão de forno a lenha', 'Padaria', 2.2, 'unid.', 45, false, []],
  ['bolo', 'pao', 'Bolo de castanha', 'Padaria', 6.0, 'unid.', 15, false, ['Outono']],
];

// Cada avaliação: nota | [nota, comentário, { m: moderação, por: [quem denunciou] }]. "p" = avaliação ao produtor.
// Encomendas: [chave, comprador, produtor, linhas, estado, dias atrás, entrega ao domicílio?, avaliações]
const ENCOMENDAS = [
  ['H1', 'maria', 'horta', [['kiwi', 3], ['couve', 2]], 'entregue', 12, true, {
    p: [5, 'Produtos fresquíssimos e entrega pontual. Voltarei a encomendar.'],
    kiwi: [5, 'Doces e firmes, aguentaram bem uma semana na fruteira.'], couve: [4, 'Ótima para o caldo verde, só vinha um pouco terrosa.'] }],
  ['H2', 'joao', 'horta', [['abobora', 4], ['marmelo', 2]], 'entregue', 11, false, {
    p: [4, 'Tudo bem embalado.'], abobora: [4, 'Dá uma sopa excelente.'], marmelo: [5, 'Perfumados, fiz marmelada com eles.'] }],
  ['H3', 'beiral', 'horta', [['kiwi', 10], ['abobora', 8], ['grelos', 3]], 'entregue', 10, true, {
    p: [5, 'Para um restaurante a regularidade é essencial. Aqui há.'],
    kiwi: [5, 'Calibre certo para a sobremesa.'], abobora: [4, 'Calibres homogéneos.'], grelos: [4, 'Tenros e pouco amargos.'] }],
  ['H4', 'ana', 'horta', [['couve', 3], ['grelos', 2]], 'entregue', 9, false, {
    p: 4, couve: [5, 'Sabor autêntico.'], grelos: [3, 'Mais amargos do que esperava, mas é o que se espera de grelos.'] }],
  ['H5', 'tasca', 'horta', [['kiwi', 5], ['castanha', 3]], 'entregue', 8, false, {
    p: [5, 'Fornecedor de confiança da tasca.'], kiwi: [4, 'Muito bons.'], castanha: [5, 'Grandes e sem bicho, ótimas para o magusto.'] }],
  ['H6', 'pedro', 'horta', [['abobora', 2], ['couve', 1]], 'entregue', 7, false, {
    p: [1, 'Preço absurdo para uma horta, não recomendo a ninguém!!!', { m: 'denunciada', por: ['horta'] }],
    abobora: [3, 'Veio um pouco passada.'], couve: [4, 'Boa.'] }],
  ['H7', 'ines', 'horta', [['marmelo', 2], ['kiwi', 2]], 'entregue', 6, false, {
    p: [5, 'Adorei, e ainda trouxeram umas nozes de oferta.'], marmelo: 5, kiwi: [5, 'Deliciosos.'] }],
  ['H8', 'tasca', 'horta', [['grelos', 2], ['couve', 2]], 'entregue', 3, false, null], // por avaliar: serve para a demo
  ['H9', 'joao', 'horta', [['grelos', 1], ['castanha', 2]], 'confirmada', 1, false, null],
  ['H10', 'tasca', 'horta', [['couve', 2], ['abobora', 1]], 'pendente', 0.1, false, null],
  ['H11', 'maria', 'horta', [['kiwi', 4], ['marmelo', 2]], 'pendente', 0.2, true, null],

  ['M1', 'joao', 'mel', [['urze', 2], ['castanheiro', 1]], 'entregue', 12, false, {
    p: [4, 'Mel de ótima qualidade.'], urze: [4, 'Sabor intenso.'], castanheiro: [5, 'Escuro e forte, o meu preferido.'] }],
  ['M2', 'maria', 'mel', [['urze', 1], ['rosmaninho', 2]], 'entregue', 10, false, {
    p: 5, urze: [5, 'Aroma intenso, textura perfeita.'], rosmaninho: [4, 'Suave e floral.'] }],
  ['M3', 'ana', 'mel', [['castanheiro', 2], ['rosmaninho', 1]], 'entregue', 8, false, {
    p: [5, 'Embalagem cuidada e mel excelente.'], castanheiro: 5, rosmaninho: 5 }],
  ['M4', 'praca', 'mel', [['urze', 6], ['castanheiro', 6], ['rosmaninho', 4]], 'entregue', 7, true, {
    p: [4, 'Vende-se muito bem na mercearia.'], urze: 5, castanheiro: [4, 'Os clientes voltam a pedir.'], rosmaninho: 5 }],
  ['M5', 'joao', 'mel', [['urze', 1]], 'entregue', 5, false, {
    urze: [1, 'Não sabe a mel de urze, é doce demais. Exijo o dinheiro de volta!!!', { m: 'denunciada', por: ['mel', 'maria'] }] }],
  ['M6', 'beiral', 'mel', null, 'entregue', 1, false, { p: [5, 'Ganhei o leilão por um bom preço e o lote veio impecável.'] }, 'leilaoMel'],
  ['M7', 'pedro', 'mel', [['urze', 2]], 'pendente', 0.15, false, null],

  ['V1', 'tasca', 'vinhos', [['alvarinho', 6], ['trajadura', 6]], 'entregue', 11, false, {
    p: [5, 'Vinhos ótimos para a tasca.'], alvarinho: [5, 'Fresco, com citrinos e boa acidez.'], trajadura: [4, 'Leve e com bom preço para o copo.'] }],
  ['V2', 'beiral', 'vinhos', [['alvarinho', 12], ['reserva', 6]], 'entregue', 9, true, {
    p: 5, alvarinho: 5, reserva: [4, 'Mais encorpado e mineral, muito bom com peixe.'] }],
  ['V3', 'maria', 'vinhos', [['trajadura', 2]], 'entregue', 6, false, { p: [4, 'Entrega rápida.'], trajadura: 5 }],
  ['V4', 'ana', 'vinhos', [['alvarinho', 1], ['reserva', 1]], 'entregue', 5, false, {
    alvarinho: [2, 'Esperava mais, para o meu gosto é um pouco ácido.', { m: 'revista', por: ['vinhos', 'joao'] }],
    reserva: [4, 'Bom vinho para ocasiões.'] }],
  ['V5', 'praca', 'vinhos', [['trajadura', 12]], 'entregue', 4, true, { p: [4, 'Bom preço para revenda.'], trajadura: 4 }],
  ['V6', 'pedro', 'vinhos', [['espumante', 2]], 'pendente', 0.4, false, null],

  ['Q1', 'maria', 'queijo', [['fresco', 3], ['requeijao', 2]], 'entregue', 10, false, {
    p: [5, 'Muito fresco.'], fresco: [5, 'Fresquíssimo, ótimo com doce de abóbora.'], requeijao: [4, 'Cremoso.'] }],
  ['Q2', 'joao', 'queijo', [['cabra', 2], ['fresco', 2]], 'entregue', 8, false, {
    p: 4, cabra: [5, 'Sabor intenso e textura firme, curado na perfeição.'], fresco: 4 }],
  ['Q3', 'pedro', 'queijo', [['cabra', 1], ['requeijao', 1]], 'entregue', 6, false, {
    p: 5, cabra: 5, requeijao: [5, 'Compra mais barato em www.descontos-queijos.example, 50% de desconto!!!', { m: 'denunciada', por: ['queijo', 'ana'] }] }],
  ['Q4', 'beiral', 'queijo', [['cabra', 4], ['fresco', 6]], 'entregue', 5, true, {
    p: [5, 'Perfeito para a tábua de queijos do restaurante.'], cabra: 4, fresco: 5 }],
  ['Q5', 'tasca', 'queijo', [['cabra', 1], ['fresco', 2]], 'pronta', 1, false, null],

  ['B1', 'ana', 'pao', [['broa', 4], ['centeio', 2]], 'entregue', 9, false, {
    p: 5, broa: [5, 'Côdea estaladiça e miolo húmido, a melhor broa da zona.'], centeio: [4, 'Boa côdea.'] }],
  ['B2', 'tasca', 'pao', [['broa', 6], ['bolo', 2]], 'entregue', 7, false, {
    p: 5, broa: [4, 'Chegou ainda morna.'], bolo: [5, 'Húmido e com sabor intenso a castanha.'] }],
  ['B3', 'ines', 'pao', [['centeio', 3], ['bolo', 1]], 'entregue', 5, false, { p: 4, centeio: 4, bolo: 4 }],
  ['B4', 'joao', 'pao', [['broa', 2]], 'entregue', 4, false, {
    p: [1, 'Atendimento de gente sem educação nenhuma, uns incompetentes.', { m: 'oculta', por: ['pao', 'maria', 'ines'] }], broa: [3, 'Normal.'] }],
  ['B5', 'maria', 'pao', [['broa', 3], ['centeio', 2]], 'entregue', 3, true, { p: 5, broa: 5, centeio: 5 }],
  ['B6', 'maria', 'pao', [['lenha', 2]], 'confirmada', 0.3, false, null],
];

const MORADAS = { maria: 'Rua Direita 24, Viana do Castelo', beiral: 'Largo do Poço 3, Ponte de Lima', praca: 'Praça da República 8, Arcos de Valdevez' };

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([
    User.deleteMany(), Product.deleteMany(), Auction.deleteMany(), Bid.deleteMany(), Order.deleteMany(), Review.deleteMany(), Notificacao.deleteMany(),
  ]);
  const agora = Date.now();
  const atras = (dias) => new Date(agora - dias * DIA);

  // ---------- utilizadores ----------
  const passwordHash = await bcrypt.hash('password123', 12);
  const produtor = (nomeExploracao, localidade, lat, lng, descricao, validado = true) =>
    ({ nomeExploracao, descricao, localidade, localizacao: { lat, lng }, validado });
  const contas = [
    { k: 'admin', nome: 'Admin', email: 'admin@exemplo.pt', papel: 'admin' },
    { k: 'horta', nome: 'Horta da Ribeira', email: 'horta@exemplo.pt', papel: 'produtor',
      produtor: produtor('Horta da Ribeira', 'Ponte de Lima', 41.767, -8.584, 'Hortícolas e fruta da época, cultivadas na várzea do rio Lima.') },
    { k: 'mel', nome: 'Mel do Soajo', email: 'mel@exemplo.pt', papel: 'produtor',
      produtor: produtor('Mel do Soajo', 'Arcos de Valdevez', 41.88, -8.30, 'Apiário de montanha no Soajo, dentro do Parque Nacional da Peneda-Gerês. Mel extraído e embalado na própria exploração.') },
    { k: 'vinhos', nome: 'Quinta da Várzea', email: 'vinhos@exemplo.pt', papel: 'produtor',
      produtor: produtor('Quinta da Várzea', 'Melgaço', 42.114, -8.259, 'Vinho Verde Alvarinho de vinha própria, na sub-região de Monção e Melgaço.') },
    { k: 'queijo', nome: 'Queijaria da Serra Amarela', email: 'queijo@exemplo.pt', papel: 'produtor',
      produtor: produtor('Queijaria da Serra Amarela', 'Ponte da Barca', 41.806, -8.417, 'Queijos de cabra, frescos e curados, feitos com o leite do rebanho da casa.') },
    { k: 'pao', nome: 'Forno de Lenha de Coura', email: 'pao@exemplo.pt', papel: 'produtor',
      produtor: produtor('Forno de Lenha de Coura', 'Paredes de Coura', 41.913, -8.563, 'Pão de forno a lenha: broa de milho, centeio e bolo de castanha, cozidos todas as manhãs.') },
    { k: 'pendente', nome: 'Pequenos Frutos do Minho', email: 'pendente@exemplo.pt', papel: 'produtor',
      produtor: produtor('Pequenos Frutos do Minho', 'Valença', 42.03, -8.64, 'Mirtilos, framboesas e compotas caseiras.', false) },
    { k: 'tasca', nome: 'Tasca do Lima', email: 'tasca@exemplo.pt', papel: 'comprador' },
    { k: 'beiral', nome: 'Restaurante O Beiral', email: 'beiral@exemplo.pt', papel: 'comprador' },
    { k: 'praca', nome: 'Mercearia da Praça', email: 'praca@exemplo.pt', papel: 'comprador' },
    { k: 'maria', nome: 'Maria Santos', email: 'maria@exemplo.pt', papel: 'comprador' },
    { k: 'joao', nome: 'João Pereira', email: 'joao@exemplo.pt', papel: 'comprador' },
    { k: 'ana', nome: 'Ana Ribeiro', email: 'ana@exemplo.pt', papel: 'comprador' },
    { k: 'pedro', nome: 'Pedro Costa', email: 'pedro@exemplo.pt', papel: 'comprador' },
    { k: 'ines', nome: 'Inês Lopes', email: 'ines@exemplo.pt', papel: 'comprador' },
  ];
  const criados = await User.create(contas.map(({ k, ...c }) => ({ ...c, passwordHash })));
  const U = Object.fromEntries(contas.map((c, i) => [c.k, criados[i]]));

  // ---------- produtos ----------
  const prods = await Product.create(PRODUTOS.map(([, p, nome, categoria, preco, unidade, stock, biologico, epocas]) =>
    ({ produtor: U[p]._id, nome, categoria, preco, unidade, stock, biologico, epocas })));
  const P = Object.fromEntries(PRODUTOS.map((d, i) => [d[0], prods[i]]));

  // ---------- leilões e licitações ----------
  const licitacoes = []; // [leilão, comprador, valor, há quantas horas]
  const leilao = async (dados, bids) => {
    const ultima = bids[bids.length - 1];
    const a = await Auction.create({
      ...dados,
      licitacaoAtual: ultima ? { valor: ultima[1], comprador: U[ultima[0]]._id } : { valor: dados.precoBase },
      numLicitacoes: bids.length,
      encomendaCriada: false,
    });
    for (const [quem, valor, horasAtras] of bids) {
      licitacoes.push({ leilao: a._id, comprador: U[quem]._id, nome: U[quem].nome, valor, createdAt: new Date(agora - horasAtras * HORA) });
    }
    return a;
  };

  // Ativo: termina daqui a 2 h (voltar a correr o seed quando acabar). Quem lidera não é a "tasca", para poder licitar.
  await leilao({
    produtor: U.horta._id, produto: P.kiwi._id, lote: '200 kg de kiwi Hayward, calibre A', quantidade: '200 kg',
    precoBase: 200, incremento: 5, iniciaEm: new Date(agora - 40 * 60 * 1000), terminaEm: new Date(agora + 2 * HORA), estado: 'ativo',
  }, [['maria', 205, 0.6], ['beiral', 210, 0.5], ['maria', 215, 0.3], ['beiral', 220, 0.1]]);

  // Agendado: começa daqui a 3 h
  await leilao({
    produtor: U.mel._id, produto: P.urze._id, lote: '40 frascos de mel de urze (500 g)', quantidade: '40 frascos',
    precoBase: 150, incremento: 5, iniciaEm: new Date(agora + 3 * HORA), terminaEm: new Date(agora + 5 * HORA), estado: 'agendado',
  }, []);

  // Terminado com vencedor (a encomenda M6 é gerada abaixo)
  const leilaoMel = await leilao({
    produtor: U.mel._id, produto: P.castanheiro._id, lote: '20 frascos de mel de castanheiro (500 g)', quantidade: '20 frascos',
    precoBase: 100, incremento: 5, iniciaEm: atras(2.1), terminaEm: atras(2), estado: 'terminado',
  }, [['maria', 105, 49], ['praca', 110, 48.9], ['beiral', 115, 48.5], ['maria', 120, 48.3], ['beiral', 125, 48.1]]);
  await Auction.updateOne({ _id: leilaoMel._id }, { encomendaCriada: true });

  // Terminado sem licitações
  await leilao({
    produtor: U.horta._id, produto: P.abobora._id, lote: '150 kg de abóbora-menina', quantidade: '150 kg',
    precoBase: 60, incremento: 2, iniciaEm: atras(1.2), terminaEm: atras(1), estado: 'terminado',
  }, []);
  await Bid.create(licitacoes);

  // ---------- encomendas ----------
  const encomendas = [];
  for (const [i, [k, quem, quemProduz, linhas, estado, dias, domicilio, , leilaoChave]] of ENCOMENDAS.entries()) {
    // A encomenda do leilão nasce no fecho; as outras espalham-se pelas horas do dia
    const createdAt = leilaoChave
      ? new Date(leilaoMel.terminaEm.getTime() + 60 * 1000)
      : new Date(agora - dias * DIA - (dias >= 1 ? ((i * 37) % 9) * HORA : 0));
    const base = { comprador: U[quem]._id, produtor: U[quemProduz]._id, estado, createdAt };
    let dados;
    if (leilaoChave) {
      const valor = leilaoMel.licitacaoAtual.valor;
      dados = { ...base, linhas: [{ produto: leilaoMel.produto, nome: leilaoMel.lote, precoUnit: valor, quantidade: 1 }],
        total: valor, entrega: { tipo: 'levantamento' }, origem: 'leilao', leilao: leilaoMel._id };
    } else {
      const ls = linhas.map(([p, quantidade]) => ({ produto: P[p]._id, nome: P[p].nome, precoUnit: P[p].preco, quantidade }));
      dados = { ...base, linhas: ls, total: arredondar(ls.reduce((s, l) => s + l.precoUnit * l.quantidade, 0)),
        entrega: domicilio ? { tipo: 'entrega', morada: MORADAS[quem] ?? 'Rua da Liberdade 10, Viana do Castelo' } : { tipo: 'levantamento' } };
    }
    encomendas.push({ k, dados });
  }
  const criadasEnc = await Order.create(encomendas.map((e) => e.dados));
  const E = Object.fromEntries(encomendas.map((e, i) => [e.k, criadasEnc[i]]));

  // ---------- avaliações (e denúncias) ----------
  const avaliacoes = [];
  for (const [k, quem, quemProduz, linhas, , , , rev] of ENCOMENDAS) {
    if (!rev) continue;
    const enc = E[k];
    let n = 0;
    for (const [chave, valor] of Object.entries(rev)) {
      const [classificacao, comentario, mod] = Array.isArray(valor) ? valor : [valor];
      const createdAt = new Date(Math.min(agora - 30 * 60 * 1000, enc.createdAt.getTime() + (1 + (n++ % 2)) * DIA));
      avaliacoes.push({
        autor: U[quem]._id, produtor: U[quemProduz]._id, encomenda: enc._id,
        ...(chave === 'p' ? {} : { produto: P[chave]._id }),
        classificacao, comentario,
        moderacao: mod?.m ?? 'ok', denunciadoPor: (mod?.por ?? []).map((x) => U[x]._id), createdAt,
      });
    }
  }
  await Review.create(avaliacoes);

  // ---------- notificações ----------
  const nota = (quem, tipo, texto, link, horasAtras, lida = false) =>
    ({ utilizador: U[quem]._id, tipo, texto, link, lida, createdAt: new Date(agora - horasAtras * HORA) });
  const nomeDe = (k) => U[k].nome;
  await Notificacao.create([
    nota('admin', 'produtor-novo', 'Novo produtor por validar: Pequenos Frutos do Minho.', '/admin', 3),
    nota('horta', 'encomenda-nova', `Nova encomenda ${codigo(E.H10._id)}, de ${euro(E.H10.total)}.`, '/produtor', 2.4),
    nota('horta', 'encomenda-nova', `Nova encomenda ${codigo(E.H11._id)}, de ${euro(E.H11.total)}.`, '/produtor', 4.8),
    nota('horta', 'avaliacao', `${nomeDe('pedro')} avaliou a tua exploração com 1 estrela.`, `/produtores/${U.horta._id}`, 20),
    nota('horta', 'avaliacao', `${nomeDe('ines')} avaliou "${P.marmelo.nome}" com 5 estrelas.`, `/produtores/${U.horta._id}`, 100, true),
    nota('horta', 'leilao-terminado', 'O leilão "150 kg de abóbora-menina" terminou sem licitações.', '/produtor', 24, true),
    nota('mel', 'encomenda-nova', `Nova encomenda ${codigo(E.M7._id)}, de ${euro(E.M7.total)}.`, '/produtor', 3.6),
    nota('mel', 'avaliacao', `${nomeDe('joao')} avaliou "${P.urze.nome}" com 1 estrela.`, `/produtores/${U.mel._id}`, 110),
    nota('mel', 'leilao-terminado', `O leilão "${leilaoMel.lote}" terminou: ${nomeDe('beiral')} ganhou por ${euro(125)}.`, '/produtor', 48, true),
    nota('tasca', 'encomenda-estado', `${nomeDe('queijo')} marcou a encomenda ${codigo(E.Q5._id)} como pronta a levantar.`, '/encomendas', 6),
    nota('tasca', 'encomenda-estado', `${nomeDe('horta')} marcou a encomenda ${codigo(E.H8._id)} como entregue.`, '/encomendas', 70, true),
    nota('beiral', 'leilao-ganho', `Ganhaste o leilão "${leilaoMel.lote}" por ${euro(125)}. A encomenda já está em "Encomendas".`, '/encomendas', 48, true),
  ]);

  const visiveis = avaliacoes.filter((a) => a.moderacao !== 'oculta');
  console.log('Seed concluído (password de todos: password123).');
  console.log(`  ${criados.length} utilizadores, ${prods.length} produtos, ${criadasEnc.length} encomendas, ${avaliacoes.length} avaliações (${visiveis.length} visíveis), ${licitacoes.length} licitações`);
  console.log(`  Fila de moderação (denunciadas): ${avaliacoes.filter((a) => a.moderacao === 'denunciada').length}`);
  console.log(`  Leilão ativo termina às ${new Date(agora + 2 * HORA).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} (hora do servidor): volta a correr o seed depois.`);
  console.log(contas.filter((c) => ['admin', 'horta', 'mel', 'tasca'].includes(c.k)).map((c) => `  ${c.papel.padEnd(10)} ${c.email}`).join('\n'));
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
