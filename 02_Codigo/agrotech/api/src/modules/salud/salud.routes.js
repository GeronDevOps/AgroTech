'use strict';

const { Router } = require('express');
const { createSaludRepository } = require('./salud.repository');
const { createSaludService } = require('./salud.service');
const { createSaludController } = require('./salud.controller');

/** Ensambla el módulo: repositorio → servicio → controlador → rutas. */
function saludRoutes({ pool }) {
  const saludRepository = createSaludRepository({ pool });
  const saludService = createSaludService({ saludRepository });
  const controller = createSaludController({ saludService });

  const router = Router();
  router.get('/', controller.obtener);
  return router;
}

module.exports = { saludRoutes };
