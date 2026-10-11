'use strict';

const { Router } = require('express');

/**
 * Rutas públicas de pagos (las protegidas viven bajo /pedidos/{id}/pago):
 *   POST /pagos/wompi/eventos   evento firmado de la pasarela (checksum SHA-256)
 *   GET  /pagos/retorno         redirect-url de Wompi: devuelve al usuario a la app (informativo)
 */
function pagosRoutes({ pagosService, wompi }) {
  const router = Router();
  router.post('/wompi/eventos', async (req, res) => {
    res.status(200).json(await pagosService.procesarEvento(req.body));
  });
  router.get('/retorno', (req, res) => {
    const id = typeof req.query.id === 'string' ? req.query.id.replace(/[^\w-]/g, '').slice(0, 64) : '';
    res.redirect(302, `${wompi.retornoApp}${id ? `?id=${encodeURIComponent(id)}` : ''}`);
  });
  return router;
}

module.exports = { pagosRoutes };
