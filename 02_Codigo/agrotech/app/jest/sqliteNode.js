/**
 * expo-sqlite para las pruebas: misma API asíncrona, ejecutada con el SQLite real de Node (node:sqlite),
 * en memoria. Así las pruebas ejercitan el SQL de la base local tal cual corre en el teléfono.
 */
// Node 22 avisa una vez que node:sqlite es experimental; no afecta las pruebas.
const { DatabaseSync } = require('node:sqlite');

const normalizar = (v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);

function parametros(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0].map(normalizar);
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object') {
    return [Object.fromEntries(Object.entries(params[0]).map(([k, v]) => [k, normalizar(v)]))];
  }
  return params.map(normalizar);
}

const plano = (fila) => (fila ? { ...fila } : null);

class BaseSimulada {
  constructor(nombre) {
    this.databasePath = nombre;
    this.db = new DatabaseSync(':memory:');
    this.cola = Promise.resolve();
  }

  async execAsync(sql) { this.db.exec(sql); }

  async runAsync(sql, ...params) {
    const r = this.db.prepare(sql).run(...parametros(params));
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
  }

  async getFirstAsync(sql, ...params) { return plano(this.db.prepare(sql).get(...parametros(params))); }

  async getAllAsync(sql, ...params) { return this.db.prepare(sql).all(...parametros(params)).map(plano); }

  /** Transacciones serializadas, como withExclusiveTransactionAsync en el teléfono. */
  withExclusiveTransactionAsync(tarea) {
    const ejecutar = async () => {
      this.db.exec('BEGIN');
      try {
        await tarea(this);
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    };
    const resultado = this.cola.then(ejecutar, ejecutar);
    this.cola = resultado.catch(() => {});
    return resultado;
  }

  withTransactionAsync(tarea) { return this.withExclusiveTransactionAsync(() => tarea()); }

  async closeAsync() { this.db.close(); }
}

module.exports = {
  openDatabaseAsync: jest.fn(async (nombre) => new BaseSimulada(nombre)),
};
