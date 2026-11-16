'use strict';

const { Router } = require('express');
const config = require('../../config/env');
const { autenticar } = require('../../middleware/autenticacion');
const { createPrivacidadService } = require('./privacidad.service');
const { createPerfilRepository } = require('../perfil/perfil.repository');

/**
 * Rutas de "Privacidad y datos" (CU-20 · RF-20 · Ley 1581 de 2012):
 *   GET    /privacidad             JWT   datos, finalidades, autorizaciones y estado de la supresión
 *   POST   /privacidad/supresion   JWT   { confirmar: true, motivo? } solicitar la supresión
 *   DELETE /privacidad/supresion   JWT   desistir de la solicitud en trámite (A2)
 * La corrección de datos es PATCH /perfil (CU-09). La nueva autorización (A3) es POST /auth/autorizacion.
 */
function privacidadRoutes({ pool, tokens, almacenFotos, correo, eventos }) {
  const privacidadService = createPrivacidadService({
    pool, almacenFotos, correo, eventos, perfilRepository: createPerfilRepository({ pool }), versionAviso: config.auth.versionAvisoPrivacidad,
  });
  const base = (req) => config.fotos.urlBase || `${req.protocol}://${req.get('host')}/fotos`;
  const auth = autenticar(tokens);

  const router = Router();
  router.get('/', auth, async (req, res) => { res.json(await privacidadService.consultar({ usuario: req.usuario, baseFotos: base(req) })); });
  router.post('/supresion', auth, async (req, res) => {
    const r = await privacidadService.solicitarSupresion({ usuario: req.usuario, body: req.body });
    res.status(r.sesionCerrada ? 200 : 202).json(r);
  });
  router.delete('/supresion', auth, async (req, res) => { res.json(await privacidadService.desistir({ usuario: req.usuario })); });
  router.privacidadService = privacidadService;
  return router;
}

module.exports = { privacidadRoutes };
