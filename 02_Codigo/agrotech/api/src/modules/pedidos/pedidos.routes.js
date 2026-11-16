'use strict';

const { Router } = require('express');
const { autenticar, autorizar } = require('../../middleware/autenticacion');
const { createPedidosRepository } = require('./pedidos.repository');
const { createPedidosService } = require('./pedidos.service');

/**
 * Rutas de pedidos (Entrega 3, Tabla 2):
 *   POST  /pedidos                 JWT · consumidor   CU-04 (cabecera Idempotency-Key)
 *   GET   /pedidos?estado=activos  JWT                CU-15 / CU-13 (según el rol)
 *   GET   /pedidos/{id}            JWT · partes       detalle con historial y pago
 *   PATCH /pedidos/{id}/estado     JWT · productor    CU-13
 *   POST  /pedidos/{id}/cancelar   JWT · partes       CU-14 { motivo, version? }
 *   GET   /pedidos?estado=activos|finalizados|todos|ESTADO&desde&hasta&pagina   CU-15 / RF-15
 *   POST  /pedidos/{id}/pago       JWT · consumidor   CU-22 iniciar pago en línea
 *   PATCH /pedidos/{id}/pago       JWT · consumidor   CU-22 A1 cambiar a contra entrega
 */
function pedidosRoutes({ pool, tokens, eventos, pagosService }) {
  const pedidosService = createPedidosService({ pool, pedidosRepository: createPedidosRepository({ pool }), eventos });
  const auth = autenticar(tokens);

  const router = Router();
  router.post('/', auth, autorizar('CONSUMIDOR'), async (req, res) => {
    const r = await pedidosService.confirmar({ usuario: req.usuario, clave: req.get('idempotency-key'), body: req.body });
    res.status(r.creado ? 201 : 200).json({ clave: r.clave, pedidos: r.pedidos });
  });
  router.get('/', auth, async (req, res) => {
    res.json(await pedidosService.listar({ usuario: req.usuario, query: req.query }));
  });
  router.get('/:id', auth, async (req, res) => {
    res.json(await pedidosService.detalle({ usuario: req.usuario, id: req.params.id }));
  });
  router.patch('/:id/estado', auth, autorizar('PRODUCTOR'), async (req, res) => {
    res.json(await pedidosService.cambiarEstado({ usuario: req.usuario, id: req.params.id, body: req.body }));
  });
  router.post('/:id/cancelar', auth, async (req, res) => {
    res.json(await pedidosService.cancelar({ usuario: req.usuario, id: req.params.id, body: req.body }));
  });
  router.post('/:id/pago', auth, autorizar('CONSUMIDOR'), async (req, res) => {
    const r = await pagosService.iniciar({ usuario: req.usuario, idPedido: req.params.id });
    res.status(r.creado ? 201 : 200).json({ pago: r.pago, urlCheckout: r.urlCheckout });
  });
  router.patch('/:id/pago', auth, autorizar('CONSUMIDOR'), async (req, res) => {
    await pagosService.cambiarAContraEntrega({ usuario: req.usuario, idPedido: req.params.id, body: req.body });
    res.json(await pedidosService.detalle({ usuario: req.usuario, id: req.params.id }));
  });
  return { router, pedidosService };
}

module.exports = { pedidosRoutes };
