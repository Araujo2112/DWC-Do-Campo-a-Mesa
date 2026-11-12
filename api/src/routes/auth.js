// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const limiteLogin = require('../middleware/limiteLogin');
const { notificarAdmins } = require('../services/notificacoes');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (v) => typeof v === 'string' && v.trim() !== '';

// O bcrypt só usa os primeiros 72 bytes da password; acima disso recusamos
// para ninguém julgar que uma password enorme é mais segura.
const MAX_BYTES_PASSWORD = 72;

// Hash "de enfeite": o login gasta o mesmo tempo quer o email exista ou não
// (senão o tempo de resposta revelava que emails estão registados).
const HASH_FALSO = bcrypt.hashSync('enfeite', 12);

// Formato único do utilizador que a API devolve (nunca inclui o hash).
// O objeto "produtor" só sai para produtores (o Mongoose cria-o vazio para todos).
const publico = (u) => {
  const o = u.toObject();
  return {
    id: o._id,
    nome: o.nome,
    email: o.email,
    papel: o.papel,
    produtor: o.papel === 'produtor' ? o.produtor : undefined,
  };
};

// POST /api/auth/registo  -> 201 { id }
router.post('/registo', async (req, res, next) => {
  try {
    const { nome, email, password, papel = 'comprador', produtor } = req.body || {};

    if (![nome, email, password].every(texto)) {
      return res.status(400).json({ erro: 'nome, email e password são obrigatórios' });
    }
    if (!EMAIL_RE.test(email.trim())) return res.status(400).json({ erro: 'Email inválido' });
    if (password.length < 8) return res.status(400).json({ erro: 'A password tem de ter pelo menos 8 caracteres' });
    if (Buffer.byteLength(password, 'utf8') > MAX_BYTES_PASSWORD) {
      return res.status(400).json({ erro: `A password não pode ter mais de ${MAX_BYTES_PASSWORD} bytes` });
    }
    // "admin" nunca se pede no registo; só se cria diretamente na base de dados.
    if (!['comprador', 'produtor'].includes(papel)) return res.status(400).json({ erro: 'Papel inválido' });

    // Um produtor sem nome da exploração e localidade ficaria com uma página pública vazia.
    if (papel === 'produtor' && (!texto(produtor?.nomeExploracao) || !texto(produtor?.localidade))) {
      return res.status(400).json({ erro: 'nomeExploracao e localidade são obrigatórios para produtores' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    if (await User.exists({ email: emailNormalizado })) {
      return res.status(409).json({ erro: 'Já existe um utilizador com esse email' });
    }

    // Os campos escolhem-se um a um (nada de ...req.body): quem se regista
    // não pode decidir sozinho o seu papel nem se está validado.
    const dados = {
      nome: nome.trim(),
      email: emailNormalizado,
      passwordHash: await bcrypt.hash(password, 12),
      papel,
    };
    if (papel === 'produtor') {
      dados.produtor = {
        nomeExploracao: produtor.nomeExploracao.trim(),
        descricao: texto(produtor.descricao) ? produtor.descricao.trim() : undefined,
        localidade: produtor.localidade.trim(),
        validado: false, // só o administrador aprova
      };
    }

    const u = await User.create(dados);
    if (papel === 'produtor') {
      await notificarAdmins(req.app.get('io'), {
        tipo: 'produtor-novo',
        texto: `Novo produtor por validar: ${dados.produtor.nomeExploracao}.`,
        link: '/admin',
      });
    }
    res.status(201).json({ id: u._id });
  } catch (err) {
    // Dois registos quase em simultâneo com o mesmo email: o índice único da BD apanha o segundo.
    if (err.code === 11000) return res.status(409).json({ erro: 'Já existe um utilizador com esse email' });
    next(err);
  }
});

// POST /api/auth/login  -> 200 { token, utilizador } | 400 | 401 | 429
router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    // Têm de ser texto: um objeto como {"$ne": null} no email seria uma injeção NoSQL.
    if (!texto(email) || !texto(password)) {
      return res.status(400).json({ erro: 'email e password são obrigatórios' });
    }

    const u = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    const passwordCerta = await bcrypt.compare(password, u ? u.passwordHash : HASH_FALSO);
    if (!u || !passwordCerta) {
      // Mesma resposta para "não existe" e "password errada".
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: String(u._id), papel: u.papel },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
    );
    res.json({ token, utilizador: publico(u) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/eu  -> 200 utilizador autenticado
router.get('/eu', auth(), async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(401).json({ erro: 'O utilizador já não existe' });
    res.json(publico(u));
  } catch (err) {
    next(err);
  }
});

module.exports = router;