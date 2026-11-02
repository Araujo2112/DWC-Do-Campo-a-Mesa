// Limita as tentativas de login falhadas por IP (trava ataques de força bruta).
// skipSuccessfulRequests: só as respostas de erro (400/401) contam para o limite.
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.' },
});