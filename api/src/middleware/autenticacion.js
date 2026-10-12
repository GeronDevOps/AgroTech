'use strict';

const { errores } = require('../utils/http-error');

/**
 * Exige un JWT válido en "Authorization: Bearer <token>" y deja { id, rol } en req.usuario.
 * 401 NO_AUTENTICADO sin token o con token alterado; 401 SESION_EXPIRADA si venció.
 */
function autenticar(tokens) {
  return function autenticarPeticion(req, res, next) {
    const cabecera = req.get('authorization') || '';
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) return next(errores.noAutenticado());
    try {
      req.usuario = tokens.verificar(token);
      return next();
    } catch (err) {
      return next(err.name === 'TokenExpiredError' ? errores.sesionExpirada() : errores.noAutenticado('La sesión no es válida.'));
    }
  };
}

/** Restringe la ruta a uno o varios roles. Usar siempre después de autenticar(). */
function autorizar(...roles) {
  return function autorizarRol(req, res, next) {
    if (!req.usuario || !roles.includes(req.usuario.rol)) return next(errores.sinPermiso());
    return next();
  };
}

module.exports = { autenticar, autorizar };
