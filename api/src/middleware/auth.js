// Passo 6: autenticação por JWT + controlo de acesso por papel.
// Uso: router.post('/', auth('produtor'), handler)   -> só produtores
//      router.get('/', auth(), handler)              -> qualquer utilizador autenticado
const jwt = require('jsonwebtoken');

module.exports = (...papeis) => (req, res, next) => {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token inválido ou em falta' });
  }
  try {
    // O algoritmo fica fixo: assim um token com "alg: none" ou outro algoritmo é recusado.
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); // { id, papel }
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou em falta' });
  }
  if (papeis.length && !papeis.includes(req.user.papel)) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }
  next();
};