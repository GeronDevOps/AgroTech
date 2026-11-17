'use strict';

const { errores } = require('../utils/http-error');

/**
 * Exige un JWT válido en "Authorization: Bearer <token>" y deja { id, rol } en req.usuario.
 * 401 NO_AUTENTICADO sin token o con token alterado; 401 SESION_EXPIRADA si venció.
 * Si `tokens.vigencia` existe (API completa, migración 006) también rechaza con 401 SESION_EXPIRADA
 * los tokens de una sesión cerrada (contraseña restablecida, CU-08 paso 4) o de una cuenta suspendida (CU-18).
 */
function autenticar(tokens) {
  return async function autenticarPeticion(req, res, next) {
    const cabecera = req.get('authorization') || '';
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) return next(errores.noAutenticado());
    let datos;
    try {
      datos = tokens.verificar(token);
    } catch (err) {
      return next(err.name === 'TokenExpiredError' ? errores.sesionExpirada() : errores.noAutenticado('La sesión no es válida.'));
    }
    if (tokens.vigencia) {
      let estado;
      try {
        estado = await tokens.vigencia(datos);
      } catch (err) {
        return next(err);
      }
      if (estado === 'SUSPENDIDA') return next(errores.sesionExpirada('La cuenta fue suspendida. Comuníquese con la asociación.'));
      if (estado !== 'VIGENTE') return next(errores.sesionExpirada('La sesión se cerró. Inicie sesión de nuevo.'));
    }
    req.usuario = { id: datos.id, rol: datos.rol };
    return next();
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
