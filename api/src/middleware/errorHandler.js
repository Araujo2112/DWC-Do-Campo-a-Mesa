// Tratamento centralizado de erros: converte erros do Mongoose em códigos HTTP
module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.name === 'ValidationError') {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: err.errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ erro: 'Identificador inválido' });
  }
  console.error(err);
  res.status(err.status || 500).json({ erro: err.message || 'Erro interno' });
};
