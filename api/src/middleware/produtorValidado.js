// Deixa passar só produtores já validados pelo administrador.
// Usar DEPOIS de auth('produtor'): router.post('/', auth('produtor'), produtorValidado, ...)
// Consulta a base de dados (e não o JWT) para o bloqueio acabar logo que o admin aprova.
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select('papel produtor.validado produtor.rejeitado');
    if (!u) return res.status(401).json({ erro: 'O utilizador já não existe' });
    if (u.papel !== 'produtor') return res.status(403).json({ erro: 'Sem permissão' });
    if (u.produtor?.rejeitado) {
      return res.status(403).json({ erro: 'O registo de produtor foi rejeitado pelo administrador' });
    }
    if (!u.produtor?.validado) {
      return res.status(403).json({ erro: 'A conta de produtor ainda não foi validada pelo administrador' });
    }
    next();
  } catch (err) {
    next(err);
  }
};