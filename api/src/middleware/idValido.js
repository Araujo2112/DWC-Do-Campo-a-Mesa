// Recusa com 400 os ids que não são ObjectId (evita CastError e consultas inúteis à BD).
// Uso: router.get('/:id', idValido(), handler)
const { isObjectIdOrHexString } = require('mongoose');

module.exports = (parametro = 'id') => (req, res, next) =>
  isObjectIdOrHexString(req.params[parametro])
    ? next()
    : res.status(400).json({ erro: 'Identificador inválido' });