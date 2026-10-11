'use strict';

const http = require('node:http');
const config = require('./config/env');
const { pool } = require('./db/pool');
const { createApp } = require('./app');

const app = createApp({ pool });
// Servidor HTTP propio: en la Fase 4 el servidor WebSocket se monta sobre él (mismo proceso).
const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`[api] AgroTech escuchando en http://localhost:${config.port}/api/v1 (${config.env})`);
});

function shutdown(signal) {
  console.log(`[api] ${signal} recibido: cerrando conexiones…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
