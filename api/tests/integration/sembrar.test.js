'use strict';

const fs = require('node:fs/promises');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { sembrar, uuidDe, PRODUCTOS, PEDIDOS } = require('../../scripts/sembrar');

let servidor; let api;
const contar = async (tabla) => (await pool.query(`SELECT count(*)::int AS n FROM ${tabla}`)).rows[0].n;

beforeAll(async () => {
  await migrate({ log: () => {} });
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  servidor = createApp({ pool }).listen(0);
  api = `http://127.0.0.1:${servidor.address().port}`;
});

afterAll(async () => {
  await new Promise((r) => servidor.close(r));
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('npm run sembrar (datos de demostración · AGRO-15)', () => {
  test('crea cuentas, publicaciones con foto y un pedido en cada estado; repetirlo no duplica nada', async () => {
    const primera = await sembrar({ api, log: () => {} });
    expect(Object.keys(primera.cuentas)).toHaveLength(6);
    expect(Object.keys(primera.productos)).toHaveLength(PRODUCTOS.length);
    expect(primera.resumen.map((r) => [r.pedido, r.estado])).toEqual(PEDIDOS.map((p) => [p.clave, p.estado]));
    expect(await contar('calificacion')).toBe(1);
    expect(await contar('mensaje')).toBe(3);

    const antes = { usuario: await contar('usuario'), producto: await contar('producto'), pedido: await contar('pedido') };
    const segunda = await sembrar({ api, log: () => {} });
    expect({ usuario: await contar('usuario'), producto: await contar('producto'), pedido: await contar('pedido') }).toEqual(antes);
    expect(await contar('mensaje')).toBe(3);
    expect(segunda.resumen.map((r) => r.estado)).toEqual(primera.resumen.map((r) => r.estado));
    expect(segunda.productos.papa.id).toBe(uuidDe('producto:papa'));
  }, 20_000); // siembra completa dos veces: bcrypt y fotos reales

  test('uuidDe produce UUID v4 válidos y estables', () => {
    expect(uuidDe('x')).toBe(uuidDe('x'));
    expect(uuidDe('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
