'use strict';

const { Router } = require('express');
const { autenticar, autorizar } = require('../../middleware/autenticacion');
const { createCalificacionesRepository } = require('./calificaciones.repository');
const { createCalificacionesService } = require('./calificaciones.service');

/**
 * Rutas de calificaciones (CU-06 · RF-06):
 *   POST /pedidos/{id}/calificacion       JWT · consumidor del pedido   { puntuacion 1–5, comentario? }
 *   GET  /productores/{id}/calificaciones JWT                           opiniones y promedio
 */
function calificacionesRoutes({ pool, tokens, eventos }) {
  const calificacionesService = createCalificacionesService({ pool, calificacionesRepository: createCalificacionesRepository({ pool }), eventos });
  const auth = autenticar(tokens);

  const porPedido = Router({ mergeParams: true });
  porPedido.post('/', auth, autorizar('CONSUMIDOR'), async (req, res) => {
    res.status(201).json(await calificacionesService.calificar({ usuario: req.usuario, idPedido: req.params.id, body: req.body }));
  });

  const porProductor = Router({ mergeParams: true });
  porProductor.get('/', auth, async (req, res) => {
    res.json(await calificacionesService.delProductor({ idProductor: req.params.id, query: req.query }));
  });

  return { porPedido, porProductor, calificacionesService };
}

module.exports = { calificacionesRoutes };
