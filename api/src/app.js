// Configuração da aplicação Express (sem arrancar o servidor, para facilitar testes)
const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

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
