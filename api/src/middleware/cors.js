'use strict';

/**
 * CORS mínimo para la vista web de Expo en desarrollo.
 * La app Android no lo necesita; en producción la lista queda vacía salvo el panel web (Fase 2).
 */
// En desarrollo la vista web puede abrirse como localhost, 127.0.0.1 o con la IP del computador en la red local.
const ORIGEN_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$/;

function cors(origenes, { redLocal = false } = {}) {
  const permitidos = new Set(origenes);
  return (req, res, next) => {
    const origen = req.headers.origin;
    if (origen && (permitidos.has(origen) || (redLocal && ORIGEN_LOCAL.test(origen)))) {
      res.set({
        'Access-Control-Allow-Origin': origen,
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
        Vary: 'Origin',
      });
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    return next();
  };
}

module.exports = { cors, ORIGEN_LOCAL };
