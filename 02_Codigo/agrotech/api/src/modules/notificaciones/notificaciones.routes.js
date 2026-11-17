'use strict';

const { Router } = require('express');
const { autenticar } = require('../../middleware/autenticacion');

/**
 * Bandeja interna de avisos (CU-16 A1/A3 · RF-16):
 *   GET  /notificaciones           JWT   avisos del usuario y cuántos no ha leído (?pagina)
 *   POST /notificaciones/leidas    JWT   { ids?: [uuid] } marca leídas (sin ids: todas)
 */
function notificacionesRoutes({ tokens, notificacionesService }) {
  const auth = autenticar(tokens);
  const router = Router();
  router.get('/', auth, async (req, res) => { res.json(await notificacionesService.bandeja({ usuario: req.usuario, query: req.query })); });
  router.post('/leidas', auth, async (req, res) => { res.json(await notificacionesService.marcarLeidas({ usuario: req.usuario, body: req.body })); });
  return router;
}

module.exports = { notificacionesRoutes };
