'use strict';

const { version } = require('../../../package.json');

/**
 * Capa de negocio: no conoce Express ni SQL.
 * Informa si la API y la base de datos están operativas (monitoreo de RNF-07).
 */
function createSaludService({ saludRepository }) {
  return {
    async estado() {
      try {
        const latenciaMs = await saludRepository.ping();
        const migracion = await saludRepository.ultimaMigracion();
        return {
          estado: 'ok',
          version,
          baseDeDatos: { estado: 'ok', latenciaMs: Math.round(latenciaMs * 10) / 10, migracion },
        };
      } catch {
        return { estado: 'degradado', version, baseDeDatos: { estado: 'sin_conexion' } };
      }
    },
  };
}

module.exports = { createSaludService };
