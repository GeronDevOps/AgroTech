'use strict';

/**
 * Ejecutor de migraciones SQL versionadas.
 * - Aplica en orden los archivos NNN_descripcion.sql de db/migrations.
 * - Cada archivo corre en su propia transacción y se registra en schema_migrations.
 * - Un advisory lock impide que dos procesos migren al mismo tiempo.
 * - Si un archivo ya aplicado cambió (checksum distinto), se detiene: las migraciones no se editan.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config/env');
const { pool } = require('./pool');

const LOCK_ID = 727301; // identificador arbitrario del advisory lock
const FILE_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');

async function listMigrations(dir) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const bad = files.filter((f) => !FILE_RE.test(f));
  if (bad.length) throw new Error(`Nombre de migración inválido: ${bad.join(', ')} (formato NNN_descripcion.sql)`);
  return Promise.all(files.map(async (name) => {
    const sql = await fs.readFile(path.join(dir, name), 'utf8');
    // El checksum se calcula con saltos de línea LF: el mismo archivo clonado en Windows (CRLF) no cuenta como "editado".
    const lf = sql.replace(/\r\n/g, '\n');
    const checksum = sha256(lf);
    return { version: name.slice(0, 3), name, sql, checksum, equivalentes: [checksum, sha256(sql), sha256(lf.replace(/\n/g, '\r\n'))] };
  }));
}

async function migrate({ dir = config.migrationsDir, log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     CHAR(3) PRIMARY KEY,
        nombre      TEXT        NOT NULL,
        checksum    CHAR(64)    NOT NULL,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query('SELECT version, nombre, checksum FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.version, r]));
    const migrations = await listMigrations(dir);
    const done = [];

    for (const m of migrations) {
      const prev = applied.get(m.version);
      if (prev) {
        if (!m.equivalentes.includes(prev.checksum.trim())) {
          throw new Error(`La migración ${m.name} cambió después de aplicarse. Cree una migración nueva en lugar de editarla.`);
        }
        continue;
      }
      log(`[migrate] aplicando ${m.name}`);
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, nombre, checksum) VALUES ($1, $2, $3)',
          [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
        done.push(m.name);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló ${m.name}: ${err.message}`, { cause: err });
      }
    }
    log(done.length ? `[migrate] ${done.length} migración(es) aplicada(s).` : '[migrate] la base de datos ya está al día.');
    return done;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(`[migrate] ${err.message}`);
      await pool.end();
      process.exit(1);
    });
}

/** Versiones de migración que existen en db/migrations y aún no se han aplicado. */
async function pendientes({ dir = config.migrationsDir } = {}) {
  const { rows } = await pool.query(`SELECT to_regclass('schema_migrations') IS NOT NULL AS existe`);
  const aplicadas = rows[0].existe ? new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version)) : new Set();
  return (await listMigrations(dir)).filter((m) => !aplicadas.has(m.version)).map((m) => m.name);
}

module.exports = { migrate, listMigrations, pendientes };
