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

/**
 * Emisión y verificación de JWT firmados con HS256. Contenido mínimo: sub (id), rol y sv.
 * sv = versión de sesión del usuario (migración 006): al restablecer la contraseña (CU-08),
 * suspender la cuenta (CU-18) o suprimir los datos (CU-20) se incrementa y los tokens anteriores dejan de valer.
 */
function createTokens({ secreto, expiraEn }) {
  return {
    firmar(usuario) {
      const token = jwt.sign({ rol: usuario.rol, sv: usuario.version_sesion || 0 }, secreto, {
        algorithm: 'HS256',
        subject: usuario.id_usuario,
        issuer: EMISOR,
        audience: AUDIENCIA,
        expiresIn: expiraEn,
      });
      const { exp } = jwt.decode(token);
      return { token, tipo: 'Bearer', expiraEn: new Date(exp * 1000).toISOString() };
    },

    /** Devuelve { id, rol, sv } o lanza el error de jsonwebtoken (TokenExpiredError, JsonWebTokenError). */
    verificar(token) {
      const datos = jwt.verify(token, secreto, { algorithms: ['HS256'], issuer: EMISOR, audience: AUDIENCIA });
      return { id: datos.sub, rol: datos.rol, sv: datos.sv || 0 };
    },
  };
}

/**
 * Comprobación de vigencia de la sesión contra la base de datos (una consulta por petición autenticada).
 * Devuelve 'VIGENTE', 'CERRADA' (versión de sesión anterior: contraseña restablecida) o 'SUSPENDIDA'.
 */
function createVigenciaSesion({ pool }) {
  return async function vigencia({ id, sv }) {
    const { rows } = await pool.query('SELECT estado, version_sesion FROM usuario WHERE id_usuario = $1', [id]);
    const u = rows[0];
    if (!u || u.estado === 'ANONIMIZADA') return 'CERRADA';
    if (u.estado === 'SUSPENDIDA') return 'SUSPENDIDA';
    return u.version_sesion === (sv || 0) ? 'VIGENTE' : 'CERRADA';
  };
}

module.exports = { createHasher, createTokens, createVigenciaSesion };
