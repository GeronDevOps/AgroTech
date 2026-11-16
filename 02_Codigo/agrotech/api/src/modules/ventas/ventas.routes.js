'use strict';

const { Router } = require('express');
const { autenticar, autorizar } = require('../../middleware/autenticacion');
const { createVentasService } = require('./ventas.service');

/**
 * Panel de ventas (CU-07 · RF-07):
 *   GET /ventas?periodo=semana|mes|mes_anterior|anio   JWT · productor
 *   GET /ventas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD      rango libre (A3: se corrige e informa)
 */
function ventasRoutes({ pool, tokens, ventasAhora }) {
  const ventasService = createVentasService({ pool, ...(ventasAhora ? { ahora: ventasAhora } : {}) });
  const router = Router();
  router.get('/', autenticar(tokens), autorizar('PRODUCTOR'), async (req, res) => {
    res.json(await ventasService.resumen({ usuario: req.usuario, query: req.query }));
  });
  return router;
}

module.exports = { ventasRoutes };
