# Do Campo à Mesa

Mercado digital de produtores locais com leilões em tempo real.
Trabalho prático individual de **Desenvolvimento Web e para a Cloud** (Mestrado em Engenharia Informática, IPVC–ESTG, 2026/2027).

Os produtores da região publicam os seus produtos, os compradores encomendam e os lotes sazonais ou os excedentes vendem-se em **leilões em direto**, com vários compradores a licitar ao mesmo tempo e o estado sempre consistente entre clientes.

## Endereços públicos

| | Endereço |
|---|---|
| Aplicação (SPA) | https://dwcst12345.z6.web.core.windows.net |
| API REST | https://dwc-api-12345.azurewebsites.net |
| Documentação (Swagger UI) | https://dwc-api-12345.azurewebsites.net/api-docs |
| Repositório | https://github.com/Araujo2112/DWC-Do-Campo-a-Mesa |

A API está num App Service e pode demorar alguns segundos a responder ao primeiro pedido. Pode confirmar que está acordada em `/api/health`.

### Contas de demonstração

Todas as contas têm a palavra-passe `password123`.

| Papel | Email |
|---|---|
| Administrador | `admin@exemplo.pt` |
| Produtor | `horta@exemplo.pt` (e ainda `mel@`, `vinhos@`, `queijo@` e `pao@`, todos `@exemplo.pt`) |
| Produtor por validar | `pendente@exemplo.pt` |
| Comprador | `tasca@exemplo.pt` (e ainda `beiral@`, `praca@`, `maria@`, `joao@`, `ana@`, `pedro@` e `ines@`, todos `@exemplo.pt`) |

## O que a aplicação faz

- **Visitante.** Explora o catálogo por categoria, produtor, localidade, época e modo biológico, vê as páginas públicas dos produtores (com mapa) e regista-se como comprador ou produtor.
- **Comprador.** Carrinho e encomendas (levantamento ou entrega), acompanhamento do estado, avaliação do que recebeu, denúncia de avaliações e licitação em leilões em direto.
- **Produtor.** Gere produtos, preços, stock e fotografias, atualiza o estado das encomendas, cria leilões, vê as estatísticas de vendas e edita a sua página pública. Só pode publicar depois de validado pelo administrador.
- **Administrador.** Valida ou rejeita novos produtores, modera avaliações denunciadas, acompanha os leilões ativos e o estado dos serviços na Cloud.
- **Tempo real.** Salas de leilão com contagem sincronizada, histórico de licitações e número de participantes, e notificações do estado das encomendas.

## Tecnologias

| Parte | Tecnologias |
|---|---|
| SPA | React 18, Vite, react-router 6, Bootstrap 5 e SASS (Mobile First) |
| API | Node.js 22, Express, Mongoose, Socket.io, JWT, bcryptjs, helmet, multer |
| Base de dados | MongoDB (Atlas) |
| Cloud | Azure App Service (API), Azure Storage com site estático (SPA) e Blob Storage (imagens) |
| Documentação | OpenAPI 3.0.3 com Swagger UI |

## Estrutura do repositório

```
DWC-Do-Campo-a-Mesa/
├── api/                      Node.js · Express · MongoDB · Socket.io
│   ├── openapi.yaml          especificação OpenAPI (Swagger UI em /api-docs)
│   ├── src/
│   │   ├── server.js         arranque: base de dados, HTTP e Socket.io
│   │   ├── app.js            Express: middleware, rotas, Swagger
│   │   ├── config/db.js      ligação ao MongoDB
│   │   ├── middleware/       auth (JWT e papéis), produtorValidado, idValido, limiteLogin, errorHandler
│   │   ├── models/           User, Product, Order, Auction, Bid, Review, Notificacao
│   │   ├── routes/           auth, products, producers, orders, auctions, reviews, notifications, admin
│   │   ├── services/         leiloes, cicloLeiloes, notificacoes, imagens, avaliacoes, servicos
│   │   ├── sockets/          index.js (autenticação) e leiloes.js (salas e licitação)
│   │   └── seed/seed.js      dados de demonstração
│   └── test/                 testes de ponta a ponta (node --test)
├── web/                      React (Vite) · Bootstrap 5 · SASS
│   └── src/
│       ├── main.jsx          providers, router e estilos
│       ├── App.jsx           tabela de rotas, agrupadas por papel
│       ├── api/client.js     função api(): pedidos à API com o token
│       ├── context/          AuthContext, CarrinhoContext, NotificacoesContext
│       ├── hooks/            useLeilao, useContagem, useNotificacoes
│       ├── pages/            uma página por rota (inclui produtor/ e admin/)
│       ├── components/       componentes reutilizáveis
│       └── styles/           _variables, _mixins (Mobile First), parciais e main.scss
└── docs/                     relatório e notas
```

## Pré-requisitos

- Node.js 22 ou superior
- MongoDB local ou um cluster gratuito no [MongoDB Atlas](https://www.mongodb.com/atlas)

## Arranque local

```bash
# API
cd api
cp .env.example .env          # preencher MONGODB_URI e JWT_SECRET
npm install
npm run seed                  # dados de demonstração (apaga os dados existentes)
npm run dev                   # http://localhost:3000  ·  docs em /api-docs

# SPA (noutro terminal)
cd web
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Para a SPA usar a API, `VITE_USAR_DADOS_SIMULADOS` tem de estar a `false`.

Para verificar que a API está a funcionar:

| Pedido | Resposta esperada |
|---|---|
| `GET /api/health` | `200` |
| `GET /api/products` | `200` com a lista de produtos |
| `GET /api/admin/estatisticas` sem token | `401` |
| `/api-docs` | Swagger UI |

## Variáveis de ambiente

### API (`api/.env`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MONGODB_URI` | sim | Cadeia de ligação, com o nome da base antes do `?` (por exemplo `.../docampoamesa?...`) |
| `JWT_SECRET` | sim | Segredo para assinar os tokens |
| `JWT_EXPIRES_IN` | não | Validade do token (por defeito `2h`) |
| `PORT` | não | Porta da API (por defeito `3000`) |
| `CLIENT_URL` | em produção | Endereço da SPA, usado no CORS e no Socket.io (sem ele aceita qualquer origem) |
| `STORAGE_CONN` | em produção | Cadeia de ligação do Azure Blob Storage. Sem ela, as imagens ficam em `api/uploads/` |
| `STORAGE_CONTAINER` | não | Nome do contentor das imagens (por defeito `produtos`) |
| `TRUST_PROXY` | em produção | Número de proxies à frente da API (`1` no App Service) |
| `LOGIN_RATE_MAX` | não | Falhas de login por IP em 15 minutos (por defeito `10`) |
| `CICLO_LEILOES_MS` | não | Intervalo do ciclo dos leilões em milissegundos (por defeito `5000`) |

### SPA (`web/.env`)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | Endereço da API (`http://localhost:3000` em desenvolvimento, o da API na Cloud em produção) |
| `VITE_USAR_DADOS_SIMULADOS` | `true` usa `src/data/produtos.json` em vez da API. Tem de ser `false` com a API e no build de produção |

O ficheiro `.env` nunca vai para o Git. Use os `.env.example` como modelo.

## Dados de demonstração

`npm run seed` cria 15 utilizadores (1 administrador, 6 produtores, um deles por validar, e 8 compradores), 17 produtos, 34 encomendas, 75 avaliações, 4 leilões (um deles ativo, com 2 horas de duração) e as notificações correspondentes.

**Atenção.** O seed **apaga todas as coleções** da base indicada em `MONGODB_URI` antes de inserir os dados. Confirme sempre o nome da base antes de o correr.

## Testes

Os testes são de ponta a ponta e correm contra a API **já a funcionar** e com o seed feito.

```bash
cd api
npm run dev          # num terminal
npm run seed         # uma vez, se ainda não foi feito
npm test             # noutro terminal
```

São 276 testes, que cobrem a autenticação, os produtos, as encomendas, os leilões, as avaliações, as notificações, as imagens e o painel de serviços. Incluem testes de **concorrência**, em que vários compradores licitam o mesmo valor ao mesmo tempo e só um é aceite, e em que vários pedidos disputam o último stock de um produto.

- Por defeito apontam a `http://localhost:3000/api`. Para outro endereço, defina `API_URL` (e `SOCKET_URL`, se for diferente).
- Cada execução cria utilizadores `@teste.pt`. **Nunca os aponte à base de produção.**
- Numa máquina lenta, um teste das notificações pode esgotar o tempo. Passa quando corre isolado.

## API e tempo real

A API tem 34 operações em 8 grupos (`/api/auth`, `/api/products`, `/api/producers`, `/api/orders`, `/api/auctions`, `/api/reviews`, `/api/notifications` e `/api/admin`), todas descritas no Swagger UI em `/api-docs`. As rotas protegidas usam o cabeçalho `Authorization: Bearer <token>`, e o token obtém-se em `POST /api/auth/login`.

O Socket.io usa o mesmo token no handshake. Cada utilizador entra numa sala pessoal (`user:<id>`) e pode entrar numa sala por leilão (`leilao:<id>`).

| Evento | Sentido | Função |
|---|---|---|
| `entrar`, `sair` | cliente → servidor | Entrar ou sair da sala de um leilão |
| `estado` | servidor → cliente | Leilão, últimas licitações e hora do servidor |
| `licitar` | cliente → servidor | Pedido de licitação |
| `nova-licitacao` | servidor → sala | Licitação aceite |
| `recusada` | servidor → cliente | Motivo da recusa |
| `presenca`, `terminado` | servidor → sala | Participantes e fim do leilão |
| `notificacao`, `encomenda-nova`, `encomenda-atualizada`, `leilao-ganho`, `leilao-terminado` | servidor → sala pessoal | Notificações e mudanças de estado |

## Decisões principais

- **Licitação atómica.** A validação e a escrita são uma única operação (`findOneAndUpdate` com as regras no filtro, em `sockets/leiloes.js`), por isso duas licitações simultâneas nunca são ambas aceites.
- **Fecho dos leilões.** Um ciclo de 5 segundos (`services/cicloLeiloes.js`) fecha os leilões de forma atómica e cria a encomenda do vencedor. Um índice único em `Order.leilao` garante uma só encomenda por leilão, e o ciclo recupera os leilões que ficaram sem encomenda se o servidor falhar a meio.
- **Stock.** Desconta-se com operações atómicas por produto, com compensação se algo falhar.
- **Segurança.** JWT com expiração e papéis, bcrypt com custo 12, login que não revela se o email existe, validação dos campos de cada rota, tipo de imagem detetado pelos primeiros bytes do ficheiro e segredos só em variáveis de ambiente.
- **Modelo de dados.** Embebe-se o que é sempre lido em conjunto (linhas das encomendas, licitação atual do leilão) e referencia-se o que cresce sem limite (licitações, avaliações, notificações).

A justificação completa está no relatório.

## Deployment (Azure)

Os recursos estão no grupo `dwc-rg` (West Europe).

| Componente | Serviço |
|---|---|
| API e Socket.io | App Service (Linux, B1, Node 22), com WebSockets e Always On ligados |
| SPA | Storage `dwcst12345`, com site estático (`$web`) |
| Imagens | Blob Storage, contentor `produtos` |
| Base de dados | MongoDB Atlas (tier gratuito) |

**API.** As variáveis da tabela acima ficam nas App Settings do App Service. Como o build no servidor falhou, o deploy faz-se com as dependências já instaladas:

```bash
cd api
npm ci
# criar um zip com o conteúdo de api/, incluindo node_modules
az webapp config appsettings set -n dwc-api-12345 -g dwc-rg --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false
az webapp deploy -n dwc-api-12345 -g dwc-rg --src-path api.zip --type zip
```

Isto só funciona porque todas as dependências são JavaScript puro (por isso a API usa `bcryptjs` e não `bcrypt`).

**SPA.**

```bash
cd web
# VITE_API_URL a apontar para a API e VITE_USAR_DADOS_SIMULADOS=false
npm run build
az storage blob upload-batch --account-name dwcst12345 -s dist -d '$web' --overwrite
```

Para confirmar que a API só aceita HTTPS:

```bash
az webapp show -n dwc-api-12345 -g dwc-rg --query httpsOnly
```

## Limitações conhecidas

- O token do socket só é verificado no handshake, por isso um socket aberto pode continuar a licitar depois de o token expirar.
- O stock não usa uma transação: se o processo falhar a meio de um checkout, o stock descontado pode perder-se.
- Só há uma instância da API. Com mais, o Socket.io precisaria do adapter Redis.
- Os breakpoints do Bootstrap (576, 768, 992, 1200 e 1400 px) coexistem com os do SASS (768, 1024 e 1280 px).
- A SPA, alojada numa Storage, devolve um 404 do Azure no refresh de uma rota interna (a aplicação abre na mesma).
- Há contas de exemplo em produção, para facilitar a avaliação.

## Declaração de uso de IA

Foi usado o assistente de IA Claude (Sonnet 5.5, da Anthropic) ao longo do trabalho, como descrito no relatório.
