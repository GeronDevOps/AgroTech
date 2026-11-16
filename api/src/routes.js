'use strict';

const { Router } = require('express');
const config = require('./config/env');
const { saludRoutes } = require('./modules/salud/salud.routes');
const { authRoutes } = require('./modules/auth/auth.routes');
const { productosRoutes } = require('./modules/productos/productos.routes');
const { pedidosRoutes } = require('./modules/pedidos/pedidos.routes');
const { pagosRoutes } = require('./modules/pagos/pagos.routes');
const { syncRoutes } = require('./modules/sync/sync.routes');
const { mensajesRoutes } = require('./modules/mensajes/mensajes.routes');
const { calificacionesRoutes } = require('./modules/calificaciones/calificaciones.routes');
const { ventasRoutes } = require('./modules/ventas/ventas.routes');
const { dispositivosRoutes } = require('./modules/dispositivos/dispositivos.routes');
const { createNotificacionesService } = require('./modules/notificaciones/notificaciones.service');
const { fcmDesdeConfig } = require('./modules/notificaciones/fcm');
const { createPagosService } = require('./modules/pagos/pagos.service');
const { createPagosRepository } = require('./modules/pagos/pagos.repository');
const { createTokens, createVigenciaSesion } = require('./modules/auth/seguridad');
const { createBusEventos } = require('./eventos');
const { createCorreo } = require('./modules/correo/correo');
const { perfilRoutes } = require('./modules/perfil/perfil.routes');
const { privacidadRoutes } = require('./modules/privacidad/privacidad.routes');
const { reportesRoutes } = require('./modules/reportes/reportes.routes');
const { adminRoutes } = require('./modules/admin/admin.routes');
const { notificacionesRoutes } = require('./modules/notificaciones/notificaciones.routes');

/**
 * Punto único donde se montan los módulos bajo /api/v1.
 * Los módulos protegidos reciben `tokens` para usar autenticar(tokens) y autorizar(rol).
 * El servidor WebSocket (tiempo-real) y las notificaciones push escuchan el bus `eventos`.
 */
function apiRoutes(deps) {
  const base = deps.tokens || createTokens({ secreto: config.auth.jwtSecreto, expiraEn: config.auth.jwtExpiraEn });
  // Fase 2 (migración 006): cada petición autenticada comprueba que la sesión siga vigente
  // (contraseña restablecida, cuenta suspendida o datos suprimidos cierran las sesiones abiertas).
  const tokens = { ...base, vigencia: createVigenciaSesion({ pool: deps.pool }) };
  const eventos = deps.eventos || createBusEventos();
  const wompi = deps.wompi || config.wompi;
  const correo = deps.correo || createCorreo(config.correo);
  const pagosService = createPagosService({ pool: deps.pool, pagosRepository: createPagosRepository(), wompi, eventos });
  const modDeps = { ...deps, tokens, eventos, wompi, pagosService, correo };
  const pedidos = pedidosRoutes(modDeps);
  const productos = productosRoutes(modDeps);
  const mensajes = mensajesRoutes(modDeps);
  const calificaciones = calificacionesRoutes(modDeps);
  const perfil = perfilRoutes(modDeps);
  const privacidad = privacidadRoutes(modDeps);
  const reportes = reportesRoutes(modDeps);
  const sync = syncRoutes({
    ...modDeps,
    productosService: productos.productosService,
    mensajesService: mensajes.mensajesService,
    calificacionesService: calificaciones.calificacionesService,
    perfilService: perfil.perfilService,
    reportesService: reportes.reportesService,
  });

  // RF-16a: avisos push. En pruebas se inyecta un FCM simulado (deps.fcm); null = desactivados.
  const notificacionesService = createNotificacionesService({
    pool: deps.pool, eventos, fcm: deps.fcm !== undefined ? deps.fcm : fcmDesdeConfig(config.fcmCredenciales),
  });
  notificacionesService.escuchar();

  const router = Router();
  router.use('/salud', saludRoutes(modDeps));
  router.use('/auth', authRoutes(modDeps));
  router.use('/productos', productos);
  router.use('/pedidos/:id/mensajes', mensajes.porPedido);
  router.use('/pedidos/:id/calificacion', calificaciones.porPedido);
  router.use('/pedidos', pedidos.router);
  router.use('/mensajes', mensajes.bandeja);
  router.use('/productores/:id/calificaciones', calificaciones.porProductor);
  router.use('/ventas', ventasRoutes(modDeps));
  router.use('/dispositivos', dispositivosRoutes(modDeps));
  router.use('/pagos', pagosRoutes(modDeps));
  router.use('/sync', sync.router);
  router.use('/perfil', perfil);
  router.use('/privacidad', privacidad);
  router.use('/reportes', reportes);
  router.use('/notificaciones', notificacionesRoutes({ tokens, notificacionesService }));
  router.use('/admin', adminRoutes(modDeps));
  router.servicios = {
    pedidosService: pedidos.pedidosService, pagosService, syncService: sync.syncService, notificacionesService,
    privacidadService: privacidad.privacidadService, eventos, tokens, correo,
  };
  return router;
}

module.exports = { apiRoutes };
