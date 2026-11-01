# Do Campo à Mesa · código base

Mercado digital de produtores locais com leilões em tempo real.
Trabalho prático individual de **Desenvolvimento Web e para a Cloud** (MEI · IPVC–ESTG), 7 semanas.

Este repositório é um **ponto de partida**. A infraestrutura já está montada, com servidor, ligação à base de dados, routing, estilos, autenticação por token e sockets. As funcionalidades estão marcadas com `TODO (Passo N)`, e os endpoints por fazer respondem `501 Not Implemented`.

## Estrutura

```
do-campo-a-mesa/
├── api/                      Node.js · Express · MongoDB · Socket.io
│   ├── openapi.yaml          Passo 5: especificação OpenAPI (Swagger UI em /api-docs)
│   └── src/
│       ├── server.js         HTTP + Socket.io
│       ├── app.js            Express: middleware, rotas, Swagger
│       ├── config/db.js      ligação ao MongoDB
│       ├── middleware/       auth.js (JWT + papéis), errorHandler.js
│       ├── models/           User, Product, Order, Auction, Bid, Review (Passo 4)
│       ├── routes/           auth, products, producers, orders, auctions, reviews, admin (Passo 3)
│       ├── sockets/          index.js (autenticação), leiloes.js (Passo 7)
│       ├── services/         imagens.js: storage na Cloud (Passo 8)
│       └── seed/seed.js      dados de exemplo
├── web/                      React (Vite) · Bootstrap 5 · SASS
│   └── src/
│       ├── App.jsx           rotas (visitante, comprador, produtor, admin)
│       ├── api/client.js     pedidos à API com o token JWT
│       ├── context/          AuthContext, CarrinhoContext (estado global)
│       ├── hooks/            useLeilao (Socket.io), useNotificacoes
│       ├── components/       Navbar, CartaoProduto, EstadoEncomenda, RotaProtegida…
│       ├── pages/            Catalogo, Produtor, Leiloes, SalaLeilao, Carrinho, Encomendas, …
│       ├── styles/           _variables, _mixins (Mobile First), _catalogo, main.scss
│       └── data/             produtos.json: dados simulados (semana 2)
└── docs/
    └── relatorio.md          estrutura sugerida para o relatório
```

## Pré-requisitos

- Node.js 20 ou superior
- MongoDB local, ou um cluster gratuito no [MongoDB Atlas](https://www.mongodb.com/atlas)

## Arranque

```bash
# API
cd api
cp .env.example .env          # preencher MONGODB_URI e JWT_SECRET
npm install
npm run seed                  # opcional: dados de exemplo (password: password123)
npm run dev                   # http://localhost:3000  ·  docs em /api-docs

# SPA (noutro terminal)
cd web
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Com `VITE_USAR_DADOS_SIMULADOS=true`, o catálogo funciona sem API, a partir de `src/data/produtos.json`. Quando a API estiver pronta, mude para `false`.

### Utilizadores de exemplo (`npm run seed`)

Todos os utilizadores têm a password `password123`.

| Papel | Email |
|---|---|
| admin | admin@exemplo.pt |
| produtor | horta@exemplo.pt |
| produtor | mel@exemplo.pt |
| comprador | tasca@exemplo.pt |

O seed cria também 5 produtos e um leilão ativo com 30 minutos de duração.

Atenção: o seed **apaga** as coleções de utilizadores, produtos e leilões antes de inserir os dados.

### Verificar que está tudo a funcionar

| Pedido | Resposta esperada |
|---|---|
| `GET http://localhost:3000/api/health` | `200 { "estado": "ok" }` |
| `GET http://localhost:3000/api/products` | `200` com a lista de produtos |
| `http://localhost:3000/api-docs` | Swagger UI |
| `GET /api/admin/estatisticas` sem token | `401` (o middleware de autenticação está ativo) |
| Endpoints ainda por implementar | `501 { "erro": "Por implementar", "descricao": "…" }` |

## Notas da implementação

### API (`api/`): Node.js · Express · MongoDB · Socket.io

**Já funciona:**

- arranque do servidor HTTP partilhado pela API REST e pelo Socket.io;
- ligação ao MongoDB, configuração por `.env` (ver `.env.example`) e tratamento centralizado de erros (`400` para validação, `500` para o resto);
- middleware `auth(...papeis)`: valida o token JWT e o papel do utilizador (`401` sem token, `403` sem permissão);
- Swagger UI em `/api-docs`, com o recurso `/products` documentado como exemplo;
- sockets: autenticação com o mesmo JWT da API, sala pessoal por utilizador, salas por leilão e contagem de participantes;
- serviço de upload de imagens para Azure Blob Storage (`services/imagens.js`);
- script `npm run seed` com dados de exemplo.

**Base para rever:**

- modelos User, Product, Order, Auction, Bid e Review, a rever no Passo 4 (embedding vs linking, índices).

**Por fazer:**

- as rotas estão todas definidas, mas só a pesquisa de produtos (`GET /api/products`) está implementada; as restantes respondem `501` com um comentário a explicar o que falta;
- o registo e o login (Passo 6);
- a licitação atómica nos leilões (Passo 7), com a solução indicada em comentário em `sockets/leiloes.js`.

### SPA (`web/`): React (Vite) · Bootstrap 5 · SASS

**Já funciona:**

- rotas para os 4 intervenientes (visitante, comprador, produtor, administrador), com páginas protegidas por papel (`RotaProtegida`);
- menu que se adapta ao utilizador autenticado;
- estado global da sessão (`AuthContext`) e do carrinho (`CarrinhoContext`);
- catálogo com dados simulados (pesquisa, categorias e filtro biológico); com `VITE_USAR_DADOS_SIMULADOS=false` passa a usar a API;
- ligação em tempo real à sala de leilão (hook `useLeilao`);
- SASS com as variáveis do tema, o mixin Mobile First `a-partir-de()` e a grelha do catálogo com 3 breakpoints (768, 1024 e 1280 px).

**Por fazer:**

- as páginas ainda por fazer mostram uma caixa tracejada **"Por implementar (Passo N)"** que diz o que falta.

### Onde procurar o trabalho a fazer

Há 25 marcadores `TODO (Passo N)` no código, ligados aos passos da apresentação. Para os listar todos:

```bash
grep -rn "TODO" api/src api/openapi.yaml web/src
```

### Sugestão para distribuir o código

Colocar este código num repositório GitHub marcado como **template**. Cada aluno cria a sua cópia com *Use this template*, partilha-a com o docente e trabalha nela durante as 7 semanas.

## O que já está feito e o que falta

| Passo | Semana | Já feito | Por fazer (`TODO`) |
|---|---|---|---|
| 1 · Frontend | 1 | Bootstrap + SASS com variáveis, mixin `a-partir-de()` e grelha do catálogo | 3 breakpoints em todas as páginas, estilos dos ecrãs restantes |
| 2 · SPA | 2 | Routing, rotas protegidas por papel, contexto do carrinho e da sessão, catálogo | Páginas do produtor, leilões, painéis |
| 3 · API REST | 3 | Todas as rotas definidas; `GET /api/products` implementado | Restantes endpoints (respondem 501) |
| 4 · MongoDB | 3 | Schemas base | Rever embedding vs linking, índices, avaliações |
| 5 · Swagger | 4 | Swagger UI e documentação de `/products` | Documentar os restantes recursos |
| 6 · Segurança | 4 | Middleware `auth(...papeis)` | Registo e login (bcrypt + JWT), formulários |
| 7 · Tempo real | 5 | Autenticação dos sockets, salas, presença, hook `useLeilao` | Licitação atómica, contagem decrescente, notificações |
| 8 · Cloud | 6 | Serviço de upload para Azure Blob Storage | Deployment (PaaS), variáveis de ambiente, HTTPS |

Na semana 7 ficam os testes, o relatório (`docs/relatorio.md`) e o vídeo.

## Regras do repositório

- Faça *commits* pequenos e frequentes, com mensagens claras. O histórico é considerado na avaliação.
- O ficheiro `.env` nunca vai para o Git; use `.env.example` como modelo.
- Declare no relatório as bibliotecas e os assistentes de IA que usar.
