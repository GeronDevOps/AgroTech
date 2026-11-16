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
 *   POST /auth/recuperar     pública  CU-08 pasos 1-2 (respuesta neutra)
 *   POST /auth/restablecer   pública  CU-08 pasos 3-4 (código + nueva contraseña)
 *   POST /auth/autorizacion  JWT      CU-20 A3 aceptar el aviso de privacidad vigente
 */
function authRoutes({ pool, tokens, correo }) {
  const authRepository = createAuthRepository({ pool });
  const authService = createAuthService({
    authRepository,
    hasher: createHasher({ costo: config.auth.bcryptCosto }),
    tokens,
    politica: config.auth,
    correo,
    recuperacion: config.recuperacion,
  });
  const controller = createAuthController({ authService });

  const router = Router();
  router.post('/registro', controller.registrar);
  router.post('/sesion', controller.iniciarSesion);
  router.get('/yo', autenticar(tokens), controller.yo);
  router.post('/recuperar', async (req, res) => { res.status(202).json(await authService.recuperar(req.body)); });
  router.post('/restablecer', async (req, res) => { res.json(await authService.restablecer(req.body)); });
  router.post('/autorizacion', autenticar(tokens), async (req, res) => { res.json(await authService.aceptarAviso(req.usuario.id, req.body)); });
  router.authService = authService;
  return router;
}

module.exports = { authRoutes };
