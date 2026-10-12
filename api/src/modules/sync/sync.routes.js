'use strict';

const { Router } = require('express');
const config = require('../../config/env');
const { autenticar } = require('../../middleware/autenticacion');
const { createSyncRepository } = require('./sync.repository');
const { createSyncService } = require('./sync.service');

/**
 * Rutas de sincronización (Entrega 3, Tabla 2 · CU-17 · RF-17):
 *   POST /sync/push   JWT   aplica la cola del teléfono; un resultado por idOperacion
 *   GET  /sync/pull   JWT   cambios desde la última sincronización (?desde=ISO&despuesDe=uuid)
 */
function syncRoutes({ pool, tokens, almacenFotos, productosService, mensajesService, calificacionesService }) {
  const syncService = createSyncService({
    pool, syncRepository: createSyncRepository({ pool }), productosService, mensajesService, calificacionesService, almacenFotos,
  });
  const base = (req) => config.fotos.urlBase || `${req.protocol}://${req.get('host')}/fotos`;
  const auth = autenticar(tokens);

  const router = Router();
  router.post('/push', auth, async (req, res) => {
    res.json(await syncService.push({ usuario: req.usuario, body: req.body, baseFotos: base(req) }));
  });
  router.get('/pull', auth, async (req, res) => {
    res.json(await syncService.pull({ usuario: req.usuario, query: req.query, baseFotos: base(req) }));
  });
  return { router, syncService };
}

module.exports = { syncRoutes };
