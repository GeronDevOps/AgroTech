'use strict';

/**
 * Vacía las tablas de usuarios (y en cascada todo lo demás) antes de cada prueba.
 * Las tareas en segundo plano de la prueba anterior (avisos, WebSocket cerrándose) pueden seguir escribiendo:
 * TRUNCATE choca con ellas y PostgreSQL aborta una de las dos con interbloqueo (40P01).
 * Se reintenta unas veces: el choque es momentáneo (fallo intermitente en CI, ERR-13).
 */
async function vaciarUsuarios(pool, intentos = 5) {
  for (let i = 1; ; i += 1) {
    try {
      return await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
    } catch (err) {
      if (err.code !== '40P01' || i >= intentos) throw err;
      await new Promise((r) => setTimeout(r, 100 * i));
    }
  }
}

module.exports = { vaciarUsuarios };
