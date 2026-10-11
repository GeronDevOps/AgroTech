'use strict';

const { Router } = require('express');
const { autenticar } = require('../../middleware/autenticacion');
const { createMensajesRepository } = require('./mensajes.repository');
const { createMensajesService } = require('./mensajes.service');

/**
 * Rutas del chat por pedido (CU-05 · RF-05):
 *   GET  /pedidos/{id}/mensajes          JWT · partes   historial (?despuesDe=ISO)
 *   POST /pedidos/{id}/mensajes          JWT · partes   enviar { id: uuid, contenido }
 *   POST /pedidos/{id}/mensajes/leidos   JWT · partes   marcar leídos los recibidos
 *   GET  /mensajes                       JWT            conversaciones con no leídos
 */
function mensajesRoutes({ pool, tokens, eventos }) {
  const mensajesService = createMensajesService({ pool, mensajesRepository: createMensajesRepository({ pool }), eventos });
  const auth = autenticar(tokens);

  const porPedido = Router({ mergeParams: true });
  porPedido.get('/', auth, async (req, res) => {
    res.json(await mensajesService.listar({ usuario: req.usuario, idPedido: req.params.id, query: req.query }));
  });
  porPedido.post('/', auth, async (req, res) => {
    const r = await mensajesService.enviar({ usuario: req.usuario, idPedido: req.params.id, body: req.body });
    res.status(r.creado ? 201 : 200).json({ mensaje: r.mensaje });
  });
  porPedido.post('/leidos', auth, async (req, res) => {
    res.json(await mensajesService.marcarLeidos({ usuario: req.usuario, idPedido: req.params.id }));
  });

  const bandeja = Router();
  bandeja.get('/', auth, async (req, res) => {
    res.json(await mensajesService.conversaciones({ usuario: req.usuario }));
  });

  return { porPedido, bandeja, mensajesService };
}

module.exports = { mensajesRoutes };
