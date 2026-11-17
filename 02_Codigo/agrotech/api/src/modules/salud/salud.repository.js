'use strict';

/** Capa de datos: única capa que ejecuta SQL. */
function createSaludRepository({ pool }) {
  return {
    async ping() {
      const inicio = process.hrtime.bigint();
      await pool.query('SELECT 1');
      return Number(process.hrtime.bigint() - inicio) / 1e6;
    },
    async ultimaMigracion() {
      const { rows } = await pool.query(
        "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1");
      return rows[0] ? rows[0].version : null;
    },
  };
}

module.exports = { createSaludRepository };
