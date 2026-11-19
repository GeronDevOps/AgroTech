'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { crearAyudas } = require('./ayudas');
const { vaciarUsuarios } = require('./limpiar');

// "Hoy" fijo: 15 de octubre de 2026, 10:00 en Colombia.
const app = createApp({ pool, ventasAhora: () => Date.parse('2026-10-15T15:00:00Z') });
const { cuenta, producto, confirmar, get, entregar } = crearAyudas(app);
const uuid = () => crypto.randomUUID();
const entregadoEl = (idPedido, instante) => pool.query(
  "UPDATE historial_estado SET fecha = $2 WHERE id_pedido = $1 AND estado_nuevo = 'ENTREGADO'", [idPedido, instante],
);

let rosa; let luis; let marta; let andres; let maria;

beforeAll(async () => {
  await migrate({ log: () => {} });
  await vaciarUsuarios(pool);
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  luis = await cuenta('Luis', 'PRODUCTOR', '3105559999', 'Ocaña');
  marta = await cuenta('Marta', 'PRODUCTOR', '3105558888', 'Chinácota');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  maria = await cuenta('Maria', 'CONSUMIDOR', '3205551111', 'Cúcuta');
  const papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
  const mora = await producto(rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 30 });
  const cebolla = await producto(luis.token, { nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, stock: 40, municipio: 'Ocaña' });
  const pedir = async (token, items) => (await confirmar(token, uuid(), { items })).body.pedidos[0];

  const p1 = await pedir(andres.token, [{ idProducto: papa.id, cantidad: 2 }]); // 170.000
  const p2 = await pedir(maria.token, [{ idProducto: papa.id, cantidad: 1 }, { idProducto: mora.id, cantidad: 3 }]); // 98.500
  const p3 = await pedir(andres.token, [{ idProducto: mora.id, cantidad: 2 }]); // 9.000
  await pedir(andres.token, [{ idProducto: papa.id, cantidad: 1 }]); // en curso: 85.000
  const p5 = await pedir(andres.token, [{ idProducto: cebolla.id, cantidad: 1 }]); // de Luis
  for (const p of [p1, p2, p3]) await entregar(rosa.token, p.id);
  await entregar(luis.token, p5.id);
  await entregadoEl(p1.id, '2026-10-03T15:00:00Z');
  await entregadoEl(p2.id, '2026-10-15T13:00:00Z');
  await entregadoEl(p3.id, '2026-10-01T03:00:00Z'); // 30 de septiembre, 22:00 en Colombia
  await entregadoEl(p5.id, '2026-10-05T15:00:00Z');
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-07 · Panel de ventas (AGRO-13)', () => {
  test('CA-11: "Este mes" cuenta los pedidos entregados y sus ingresos, con el día en hora de Colombia', async () => {
    const r = await get(rosa.token, '/ventas');
    expect(r.status).toBe(200);
    expect(r.body.periodo).toEqual({ codigo: 'mes', nombre: 'Este mes', desde: '2026-10-01', hasta: '2026-10-15', agrupacion: 'dia' });
    expect(r.body.correccion).toBeNull();
    expect(r.body.resumen).toEqual({ pedidosEntregados: 2, ingresos: 268500, ticketPromedio: 134250 });
    expect(r.body.serie).toHaveLength(15);
    expect(r.body.serie.filter((d) => d.pedidos)).toEqual([
      { fecha: '2026-10-03', pedidos: 1, ingresos: 170000 },
      { fecha: '2026-10-15', pedidos: 1, ingresos: 98500 },
    ]);
    expect(r.body.topProductos).toEqual([
      expect.objectContaining({ nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 3, ingresos: 255000, pedidos: 2 }),
      expect.objectContaining({ nombre: 'Mora', unidad: 'kg', cantidad: 3, ingresos: 13500, pedidos: 1 }),
    ]);
    expect(r.body.enCurso).toEqual({ pedidos: 1, valor: 85000 });
  });

  test('"Mes pasado" incluye la entrega de las 22:00 del 30 de septiembre', async () => {
    const r = await get(rosa.token, '/ventas?periodo=mes_anterior');
    expect(r.body.periodo).toMatchObject({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(r.body.resumen).toEqual({ pedidosEntregados: 1, ingresos: 9000, ticketPromedio: 9000 });
  });

  test('"Últimos 7 días" y "Este año" (agrupado por mes)', async () => {
    expect((await get(rosa.token, '/ventas?periodo=semana')).body).toMatchObject({
      periodo: { desde: '2026-10-09', hasta: '2026-10-15' }, resumen: { pedidosEntregados: 1, ingresos: 98500 },
    });
    const anio = await get(rosa.token, '/ventas?periodo=anio');
    expect(anio.body.periodo).toMatchObject({ desde: '2026-01-01', agrupacion: 'mes' });
    expect(anio.body.serie).toHaveLength(10);
    expect(anio.body.serie.slice(-2)).toEqual([
      { fecha: '2026-09', pedidos: 1, ingresos: 9000 },
      { fecha: '2026-10', pedidos: 2, ingresos: 268500 },
    ]);
  });

  test.each([
    ['fechas invertidas', '?desde=2026-10-15&hasta=2026-10-01', { desde: '2026-10-01', hasta: '2026-10-15' }, /invertidas/],
    ['fechas futuras', '?desde=2026-10-10&hasta=2026-12-31', { desde: '2026-10-10', hasta: '2026-10-15' }, /hasta hoy/],
    ['más de un año', '?desde=2024-01-01&hasta=2026-10-15', { desde: '2025-10-15', hasta: '2026-10-15' }, /máximo es un año/],
  ])('CU-07 A3: %s se corrigen e informan', async (_c, consulta, periodo, motivo) => {
    const r = await get(rosa.token, `/ventas${consulta}`);
    expect(r.status).toBe(200);
    expect(r.body.periodo).toMatchObject({ codigo: 'personalizado', ...periodo });
    expect(r.body.correccion).toMatch(motivo);
  });

  test('CU-07 A1: sin ventas, indicadores en cero', async () => {
    const r = await get(marta.token, '/ventas');
    expect(r.body.resumen).toEqual({ pedidosEntregados: 0, ingresos: 0, ticketPromedio: 0 });
    expect(r.body.topProductos).toEqual([]);
    expect(r.body.serie.every((d) => d.pedidos === 0)).toBe(true);
  });

  test('cada productor ve solo sus ventas; el consumidor no tiene panel', async () => {
    expect((await get(luis.token, '/ventas')).body.resumen).toEqual({ pedidosEntregados: 1, ingresos: 32000, ticketPromedio: 32000 });
    expect((await get(andres.token, '/ventas')).status).toBe(403);
  });

  test('400 con fechas mal escritas o periodo desconocido', async () => {
    expect((await get(rosa.token, '/ventas?desde=2026-13-01&hasta=2026-10-01')).status).toBe(400);
    expect((await get(rosa.token, '/ventas?desde=2026-10-01')).status).toBe(400);
    expect((await get(rosa.token, '/ventas?periodo=siglo')).status).toBe(400);
    // Propiedades heredadas de Object.prototype no son periodos.
    expect((await get(rosa.token, '/ventas?periodo=constructor')).status).toBe(400);
    expect((await get(rosa.token, '/ventas?periodo=toString')).status).toBe(400);
    expect((await get(rosa.token, '/ventas?periodo=mes&periodo=anio')).status).toBe(400);
  });
});
