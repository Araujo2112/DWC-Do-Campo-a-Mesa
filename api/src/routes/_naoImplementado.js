// Resposta usada nos endpoints ainda por implementar (501 Not Implemented)
module.exports = (descricao) => (req, res) =>
  res.status(501).json({ erro: 'Por implementar', endpoint: `${req.method} ${req.originalUrl}`, descricao });
