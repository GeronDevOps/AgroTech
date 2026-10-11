'use strict';

const { Router } = require('express');
const config = require('../../config/env');
const { createAuthRepository } = require('./auth.repository');
const { createAuthService } = require('./auth.service');
const { createAuthController } = require('./auth.controller');
const { createHasher } = require('./seguridad');
const { autenticar } = require('../../middleware/autenticacion');

/**
 * Rutas de cuentas (Entrega 3, tabla de recursos de la API):
 *   POST /auth/registro  pública  CU-01
 *   POST /auth/sesion    pública  CU-21
 *   GET  /auth/yo        JWT      valida el token guardado en el teléfono
 */
function authRoutes({ pool, tokens }) {
  const authRepository = createAuthRepository({ pool });
  const authService = createAuthService({
    authRepository,
    hasher: createHasher({ costo: config.auth.bcryptCosto }),
    tokens,
    politica: config.auth,
  });
  const controller = createAuthController({ authService });

  const router = Router();
  router.post('/registro', controller.registrar);
  router.post('/sesion', controller.iniciarSesion);
  router.get('/yo', autenticar(tokens), controller.yo);
  return router;
}

module.exports = { authRoutes };
