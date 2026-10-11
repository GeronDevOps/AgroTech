'use strict';

const { Router } = require('express');
const config = require('./config/env');
const { saludRoutes } = require('./modules/salud/salud.routes');
const { authRoutes } = require('./modules/auth/auth.routes');
const { createTokens } = require('./modules/auth/seguridad');

/**
 * Punto único donde se montan los módulos bajo /api/v1.
 * Los módulos protegidos reciben `tokens` para usar autenticar(tokens) y autorizar(rol).
 * Fase 3: productos. Fase 4: pedidos y pagos. Fase 5: sync. Fase 6: mensajes, ventas, dispositivos.
 */
function apiRoutes(deps) {
  const tokens = deps.tokens || createTokens({ secreto: config.auth.jwtSecreto, expiraEn: config.auth.jwtExpiraEn });
  const modDeps = { ...deps, tokens };

  const router = Router();
  router.use('/salud', saludRoutes(modDeps));
  router.use('/auth', authRoutes(modDeps));
  return router;
}

module.exports = { apiRoutes };
