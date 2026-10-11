'use strict';

const { Router } = require('express');
const config = require('./config/env');
const { saludRoutes } = require('./modules/salud/salud.routes');
const { authRoutes } = require('./modules/auth/auth.routes');
const { productosRoutes } = require('./modules/productos/productos.routes');
const { pedidosRoutes } = require('./modules/pedidos/pedidos.routes');
const { pagosRoutes } = require('./modules/pagos/pagos.routes');
const { syncRoutes } = require('./modules/sync/sync.routes');
const { createPagosService } = require('./modules/pagos/pagos.service');
const { createPagosRepository } = require('./modules/pagos/pagos.repository');
const { createTokens } = require('./modules/auth/seguridad');
const { createBusEventos } = require('./eventos');

/**
 * Punto único donde se montan los módulos bajo /api/v1.
 * Los módulos protegidos reciben `tokens` para usar autenticar(tokens) y autorizar(rol).
 * Fase 6: mensajes, ventas, dispositivos.
 */
function apiRoutes(deps) {
  const tokens = deps.tokens || createTokens({ secreto: config.auth.jwtSecreto, expiraEn: config.auth.jwtExpiraEn });
  const eventos = deps.eventos || createBusEventos();
  const wompi = deps.wompi || config.wompi;
  const pagosService = createPagosService({ pool: deps.pool, pagosRepository: createPagosRepository(), wompi, eventos });
  const modDeps = { ...deps, tokens, eventos, wompi, pagosService };
  const pedidos = pedidosRoutes(modDeps);
  const productos = productosRoutes(modDeps);
  const sync = syncRoutes({ ...modDeps, productosService: productos.productosService });

  const router = Router();
  router.use('/salud', saludRoutes(modDeps));
  router.use('/auth', authRoutes(modDeps));
  router.use('/productos', productos);
  router.use('/pedidos', pedidos.router);
  router.use('/pagos', pagosRoutes(modDeps));
  router.use('/sync', sync.router);
  router.servicios = { pedidosService: pedidos.pedidosService, pagosService, syncService: sync.syncService, eventos };
  return router;
}

module.exports = { apiRoutes };
