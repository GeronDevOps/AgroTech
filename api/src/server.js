'use strict';

const http = require('node:http');
const config = require('./config/env');
const { pool } = require('./db/pool');
const { createApp } = require('./app');
const { createServidorTiempoReal } = require('./tiempo-real/servidorWs');

const app = createApp({ pool });
// Servidor HTTP propio: el servidor WebSocket (chat y eventos de pedido) se monta sobre él, en /ws.
const server = http.createServer(app);
const { eventos, tokens } = app.locals.servicios;
const tiempoReal = createServidorTiempoReal({ server, pool, tokens, eventos });

const os = require('node:os');
const { migrate, pendientes } = require('./db/migrate');

/** Direcciones IPv4 de la red local: las que debe usar el teléfono (localhost solo sirve en el mismo computador). */
function direccionesLan() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

/**
 * Al arrancar: comprueba la base de datos y aplica las migraciones pendientes.
 * Sin esto, una base de datos de una versión anterior (p. ej. sin la 006) hace fallar el inicio de sesión.
 * AUTO_MIGRAR=false lo desactiva (producción migra en el despliegue, RUNBOOK).
 */
async function prepararBaseDeDatos() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    const destino = (() => { try { const u = new URL(config.databaseUrl); return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`; } catch { return 'DATABASE_URL'; } })();
    console.error(`[db] NO se pudo conectar a PostgreSQL en ${destino}: ${err.message}`);
    console.error('[db] Encienda PostgreSQL (o el contenedor de Docker) y revise DATABASE_URL en api/.env. Reintento en 10 s…');
    setTimeout(prepararBaseDeDatos, 10_000).unref();
    return;
  }
  try {
    const faltan = await pendientes();
    if (!faltan.length) return console.log('[db] conectada y al día');
    if (process.env.AUTO_MIGRAR === 'false') {
      return console.error(`[db] Faltan migraciones (${faltan.join(', ')}). Ejecute: npm run migrate`);
    }
    await migrate({ log: (m) => console.log(m) });
  } catch (err) {
    console.error(`[db] Error al migrar: ${err.message}`);
  }
}

server.listen(config.port, () => {
  console.log(`[api] AgroTech escuchando en http://localhost:${config.port}/api/v1 (${config.env})`);
  for (const ip of direccionesLan()) console.log(`[api] desde el teléfono (misma red Wi-Fi): http://${ip}:${config.port}`);
  prepararBaseDeDatos();
});

// Tarea programada (CU-13 A3): cada hora cancela los pedidos pendientes sin respuesta y restituye el inventario.
// Además depura los registros de operaciones de sincronización con más de 30 días (CU-17).
const { pedidosService, syncService, notificacionesService, privacidadService } = app.locals.servicios;
async function tareasHorarias() {
  try {
    const ids = await pedidosService.cancelarVencidos({ horas: config.horasCancelacionAutomatica });
    if (ids.length) console.log(`[tareas] ${ids.length} pedido(s) cancelado(s) por falta de respuesta`);
  } catch (err) {
    console.error('[tareas] error al cancelar pedidos vencidos:', err.message);
  }
  try {
    // CU-20 A1: supresiones aplazadas cuyos pedidos ya terminaron.
    const completadas = await privacidadService.procesarAplazadas();
    if (completadas.length) console.log(`[tareas] ${completadas.length} solicitud(es) de supresión completada(s)`);
  } catch (err) {
    console.error('[tareas] error al procesar supresiones aplazadas:', err.message);
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

// RF-16a / CU-04 A4: cada minuto se reintentan los avisos push que no salieron.
const tareaPush = setInterval(() => {
  notificacionesService.procesarPendientes().catch((err) => console.error('[push] reintentos:', err.message));
}, 60 * 1000);
tareaPush.unref();

function shutdown(signal) {
  console.log(`[api] ${signal} recibido: cerrando conexiones…`);
  clearInterval(tarea);
  clearInterval(tareaPush);
  tiempoReal.cerrar();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
