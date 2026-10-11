'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/** Hash de contraseñas con Bcrypt (RNF-04). Nunca se guarda ni se registra la contraseña. */
function createHasher({ costo }) {
  return {
    hash: (contrasena) => bcrypt.hash(contrasena, costo),
    comparar: (contrasena, hash) => bcrypt.compare(contrasena, hash),
  };
}

const EMISOR = 'agrotech-api';
const AUDIENCIA = 'agrotech-app';

/** Emisión y verificación de JWT firmados con HS256. Contenido mínimo: sub (id) y rol. */
function createTokens({ secreto, expiraEn }) {
  return {
    firmar(usuario) {
      const token = jwt.sign({ rol: usuario.rol }, secreto, {
        algorithm: 'HS256',
        subject: usuario.id_usuario,
        issuer: EMISOR,
        audience: AUDIENCIA,
        expiresIn: expiraEn,
      });
      const { exp } = jwt.decode(token);
      return { token, tipo: 'Bearer', expiraEn: new Date(exp * 1000).toISOString() };
    },

    /** Devuelve { id, rol } o lanza el error de jsonwebtoken (TokenExpiredError, JsonWebTokenError). */
    verificar(token) {
      const datos = jwt.verify(token, secreto, { algorithms: ['HS256'], issuer: EMISOR, audience: AUDIENCIA });
      return { id: datos.sub, rol: datos.rol };
    },
  };
}

module.exports = { createHasher, createTokens };
