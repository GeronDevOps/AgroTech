'use strict';

const { Router } = require('express');
const multer = require('multer');
const config = require('../../config/env');
const { autenticar } = require('../../middleware/autenticacion');
const { createPerfilRepository } = require('./perfil.repository');
const { createPerfilService } = require('./perfil.service');

/**
 * Rutas del perfil (CU-09 · RF-09):
 *   GET   /perfil        JWT   datos de contacto y ubicación del titular
 *   PATCH /perfil        JWT   cambio parcial; recalcula las coordenadas y registra en bitácora
 *   PUT   /perfil/foto   JWT   multipart "foto" (JPEG ≤ 300 KB)
 */
function perfilRoutes({ pool, tokens, almacenFotos }) {
  const perfilService = createPerfilService({ pool, perfilRepository: createPerfilRepository({ pool }), almacenFotos, limitesFotos: config.fotos });
  const base = (req) => config.fotos.urlBase || `${req.protocol}://${req.get('host')}/fotos`;
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.fotos.maxBytes, files: 1 } }).single('foto');
  const auth = autenticar(tokens);

  const router = Router();
  router.get('/', auth, async (req, res) => { res.json(await perfilService.obtener({ usuario: req.usuario, baseFotos: base(req) })); });
  router.patch('/', auth, async (req, res) => { res.json(await perfilService.actualizar({ usuario: req.usuario, body: req.body, baseFotos: base(req) })); });
  router.put('/foto', auth, subida, async (req, res) => {
    res.json(await perfilService.cambiarFoto({ usuario: req.usuario, archivo: req.file, baseFotos: base(req) }));
  });
  router.perfilService = perfilService;
  return router;
}

module.exports = { perfilRoutes };
