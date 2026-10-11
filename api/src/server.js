'use strict';

const http = require('node:http');
const config = require('./config/env');
const { pool } = require('./db/pool');
const { createApp } = require('./app');

const app = createApp({ pool });
// Servidor HTTP propio: en la Fase 6 el servidor WebSocket se monta sobre él (mismo proceso).
const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`[api] AgroTech escuchando en http://localhost:${config.port}/api/v1 (${config.env})`);
});

// Tarea programada (CU-13 A3): cada hora cancela los pedidos pendientes sin respuesta y restituye el inventario.
// Además depura los registros de operaciones de sincronización con más de 30 días (CU-17).
const { pedidosService, syncService } = app.locals.servicios;
async function tareasHorarias() {
  try {
    const ids = await pedidosService.cancelarVencidos({ horas: config.horasCancelacionAutomatica });
    if (ids.length) console.log(`[tareas] ${ids.length} pedido(s) cancelado(s) por falta de respuesta`);
  } catch (err) {
    console.error('[tareas] error al cancelar pedidos vencidos:', err.message);
  }
  try {
    await syncService.depurar({ dias: 30 });
  } catch (err) {
    console.error('[tareas] error al depurar operaciones de sincronización:', err.message);
  }
}
const tarea = setInterval(tareasHorarias, 60 * 60 * 1000);
tarea.unref();
setTimeout(tareasHorarias, 60 * 1000).unref();

function shutdown(signal) {
  console.log(`[api] ${signal} recibido: cerrando conexiones…`);
  clearInterval(tarea);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
