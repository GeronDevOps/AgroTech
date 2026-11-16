'use strict';

const { Router } = require('express');
const multer = require('multer');
const config = require('../../config/env');
const { autenticar, autorizar } = require('../../middleware/autenticacion');
const { createProductosRepository } = require('./productos.repository');
const { createProductosService } = require('./productos.service');
const { createProductosController } = require('./productos.controller');

/**
 * Rutas de productos (Entrega 3, tabla de recursos de la API):
 *   GET   /productos          JWT              CU-03 catálogo paginado con filtros
 *   GET   /productos/mios     JWT · productor  "Mis productos"
 *   GET   /productos/{id}     JWT              CU-03 paso 3 detalle
 *   POST  /productos          JWT · productor  CU-02 multipart: foto + miniatura + datos (JSON)
 *   PATCH /productos/{id}     JWT · productor  CU-10 / RF-10a precio, cantidad, nombre y descripción con version
 *   PATCH /productos/{id}/estado  JWT · productor  CU-10 / RF-10 { accion: PAUSAR | REACTIVAR | RETIRAR, version }
 * Catálogo: ?municipio&categoria&precioMin&precioMax&q&orden=recientes|precio_asc|precio_desc|calificacion|cercania&lat&lon&radioKm
 */
function productosRoutes({ pool, tokens, almacenFotos }) {
  const productosRepository = createProductosRepository({ pool });
  const productosService = createProductosService({ productosRepository, almacenFotos, limitesFotos: config.fotos });
  const controller = createProductosController({ productosService, urlBaseFotos: config.fotos.urlBase });

  // Las fotos quedan en memoria (≤ 300 KB) y el servicio decide si se guardan.
  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.fotos.maxBytes, files: 2, fields: 1, fieldSize: 8 * 1024 },
  }).fields([{ name: 'foto', maxCount: 1 }, { name: 'miniatura', maxCount: 1 }]);

  const soloProductor = [autenticar(tokens), autorizar('PRODUCTOR')];

  const router = Router();
  router.get('/', autenticar(tokens), controller.catalogo);
  router.get('/mios', soloProductor, controller.mios);
  router.get('/:id', autenticar(tokens), controller.detalle);
  router.post('/', soloProductor, subida, controller.publicar);
  router.patch('/:id', soloProductor, controller.editar);
  router.patch('/:id/estado', soloProductor, controller.cambiarEstado);
  router.productosService = productosService; // lo reutiliza /sync/push (operaciones PRODUCTO.EDITAR)
  return router;
}

module.exports = { productosRoutes };
