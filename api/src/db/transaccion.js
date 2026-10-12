'use strict';

/**
 * Ejecuta fn(client) dentro de una transacción con el pool inyectado.
 * ROLLBACK ante cualquier error; siempre libera la conexión.
 */
async function transaccion(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { transaccion };
