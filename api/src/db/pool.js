'use strict';

const { Pool } = require('pg');
const config = require('../config/env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Error en una conexión inactiva: se registra y el pool la reemplaza.
  console.error('[db] error en conexión inactiva:', err.message);
});

/**
 * Ejecuta una función dentro de una transacción.
 * Hace ROLLBACK si la función lanza un error y siempre libera la conexión.
 * Se usará en pedidos (CU-04), cancelaciones y sincronización.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
