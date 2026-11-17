'use strict';

const { Router } = require('express');
const { autenticar } = require('../../middleware/autenticacion');
const { createReportesService } = require('./reportes.service');

/**
 * Reportes de los usuarios (CU-19 · RF-19):
 *   POST /reportes        JWT   { tipoContenido: PRODUCTO|CALIFICACION|PEDIDO, idContenido, motivo, descripcion?, id? }
 *   GET  /reportes/mios   JWT   estado y resultado de los reportes hechos (y la lista de motivos)
 */
function reportesRoutes({ pool, tokens }) {
  const reportesService = createReportesService({ pool });
  const auth = autenticar(tokens);
  const router = Router();
  router.post('/', auth, async (req, res) => {
    const r = await reportesService.crear({ usuario: req.usuario, body: req.body });
    res.status(r.creado ? 201 : 200).json({ reporte: r.reporte });
  });
  router.get('/mios', auth, async (req, res) => { res.json(await reportesService.mios({ usuario: req.usuario })); });
  router.reportesService = reportesService;
  return router;
}

module.exports = { reportesRoutes };
