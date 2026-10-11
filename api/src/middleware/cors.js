'use strict';

/**
 * CORS mínimo para la vista web de Expo en desarrollo.
 * La app Android no lo necesita; en producción la lista queda vacía salvo el panel web (Fase 2).
 */
function cors(origenes) {
  const permitidos = new Set(origenes);
  return (req, res, next) => {
    const origen = req.headers.origin;
    if (origen && permitidos.has(origen)) {
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

module.exports = { cors };
