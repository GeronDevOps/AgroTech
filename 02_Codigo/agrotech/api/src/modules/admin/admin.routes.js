'use strict';

const { Router } = require('express');
const { autenticar } = require('../../middleware/autenticacion');
const { errores } = require('../../utils/http-error');
const { registrarBitacora } = require('../../utils/bitacora');
const config = require('../../config/env');
const { createAdminService } = require('./admin.service');

/**
 * Panel de administración (CU-18 · RF-18). Todas las rutas exigen el rol ADMINISTRADOR;
 * un intento con otro rol se rechaza (403) y queda en la bitácora (A3).
 *   GET  /admin/resumen
 *   GET  /admin/reportes?estado=abiertos|PENDIENTE|EN_REVISION|RESUELTO|DESESTIMADO|todos
 *   GET  /admin/reportes/{id}                 contenido + historial de las partes (pasa a EN_REVISION)
 *   POST /admin/reportes/{id}/resolver        { decision: DESESTIMAR|OCULTAR|SUSPENDER, resolucion, malintencionado?, confirmar? }
 *   GET  /admin/usuarios?q&rol&estado&verificado
 *   GET  /admin/usuarios/{id}
 *   POST /admin/usuarios/{id}/verificar       { verificado: true|false }
 *   POST /admin/usuarios/{id}/suspender       { motivo, confirmar? }
 *   POST /admin/usuarios/{id}/reactivar
 *   GET  /admin/supresiones
 *   GET  /admin/bitacora?limite
 */
function adminRoutes({ pool, tokens, eventos, correo, almacenFotos }) {
  const adminService = createAdminService({ pool, eventos, correo, almacenFotos });
  const base = (req) => config.fotos.urlBase || `${req.protocol}://${req.get('host')}/fotos`;
  const soloAdministrador = async (req, res, next) => {
    if (req.usuario.rol === 'ADMINISTRADOR') return next();
    await registrarBitacora(pool, { idUsuario: req.usuario.id, accion: 'ACCESO_DENEGADO', entidad: 'PANEL_ADMIN', resultado: 'RECHAZADO' }).catch(() => {});
    return next(errores.sinPermiso('Solo el administrador puede entrar al panel.'));
  };
  const admin = (req) => req.usuario;

  const router = Router();
  router.use(autenticar(tokens), soloAdministrador);
  router.get('/resumen', async (req, res) => { res.json(await adminService.resumen()); });
  router.get('/reportes', async (req, res) => { res.json(await adminService.reportes({ query: req.query })); });
  router.get('/reportes/:id', async (req, res) => { res.json(await adminService.reporte({ admin: admin(req), id: req.params.id, baseFotos: base(req) })); });
  router.post('/reportes/:id/resolver', async (req, res) => { res.json(await adminService.resolver({ admin: admin(req), id: req.params.id, body: req.body })); });
  router.get('/usuarios', async (req, res) => { res.json(await adminService.usuarios({ query: req.query })); });
  router.get('/usuarios/:id', async (req, res) => { res.json(await adminService.usuario({ id: req.params.id })); });
  router.post('/usuarios/:id/verificar', async (req, res) => { res.json(await adminService.verificar({ admin: admin(req), id: req.params.id, body: req.body })); });
  router.post('/usuarios/:id/suspender', async (req, res) => { res.json(await adminService.suspender({ admin: admin(req), id: req.params.id, body: req.body })); });
  router.post('/usuarios/:id/reactivar', async (req, res) => { res.json(await adminService.reactivar({ admin: admin(req), id: req.params.id })); });
  router.get('/supresiones', async (req, res) => { res.json(await adminService.supresiones()); });
  router.get('/bitacora', async (req, res) => { res.json(await adminService.bitacora({ query: req.query })); });
  return router;
}

module.exports = { adminRoutes };
