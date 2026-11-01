// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs'); // eslint-disable-line no-unused-vars
const jwt = require('jsonwebtoken'); // eslint-disable-line no-unused-vars
const User = require('../models/User'); // eslint-disable-line no-unused-vars
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// POST /api/auth/registo  -> 201 { id }
// TODO: validar dados, fazer hash da password com bcrypt (custo 12) e criar o utilizador.
//       Um produtor fica com produtor.validado = false até o administrador aprovar.
router.post('/registo', porFazer('Registar utilizador (comprador ou produtor)'));

// POST /api/auth/login  -> 200 { token, utilizador }
// TODO: procurar pelo email (com .select('+passwordHash')), comparar com bcrypt.compare
//       e devolver um JWT com { id, papel } assinado com process.env.JWT_SECRET.
router.post('/login', porFazer('Autenticar e devolver JWT'));

// GET /api/auth/eu  -> 200 dados do utilizador autenticado
router.get('/eu', auth(), porFazer('Devolver o utilizador autenticado'));

module.exports = router;
