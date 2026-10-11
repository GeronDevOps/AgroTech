'use strict';

const { Router } = require('express');
const { saludRoutes } = require('./modules/salud/salud.routes');

/**
 * Punto único donde se montan los módulos bajo /api/v1.
 * Fase 2 agregará: auth, dispositivos. Fase 3: productos. Fase 4: pedidos, sync…
 */
function apiRoutes(deps) {
  const router = Router();
  router.use('/salud', saludRoutes(deps));
  return router;
}

module.exports = { apiRoutes };
