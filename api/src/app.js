// Configuração da aplicação Express (sem arrancar o servidor, para facilitar testes)
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Atrás de um proxy (App Service), o IP real vem em X-Forwarded-For.
// 0 em local; no deploy põe TRUST_PROXY com o nº de proxies (provavelmente 1, a confirmar).
// Sem isto, o limite de tentativas de login contaria todos os utilizadores como um só.
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 0);

// Cabeçalhos de segurança. A CSP fica desligada: a API responde JSON e o Swagger UI precisa de scripts próprios.
// "cross-origin" permite à SPA (outra origem) consumir os recursos da API.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '100kb' }));

// Passo 5: documentação OpenAPI em /api-docs
const openapi = YAML.load(path.join(__dirname, '..', 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get('/api/health', (req, res) => res.json({ estado: 'ok' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/producers', require('./routes/producers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).json({ erro: 'Recurso não encontrado' }));
app.use(errorHandler);

module.exports = app;