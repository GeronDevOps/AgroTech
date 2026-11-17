'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const request = require('supertest');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { crearAyudas } = require('./ayudas');
const { vaciarUsuarios } = require('./limpiar');

const app = createApp({ pool });
const { cuenta, producto, confirmar, get, patch, post } = crearAyudas(app);
const uuid = () => crypto.randomUUID();
const push = (token, operaciones) => post(token, '/sync/push', { operaciones });
const editar = (idEntidad, datos, idOperacion = uuid()) => ({ idOperacion, tipo: 'PRODUCTO.EDITAR', idEntidad, datos, creadoEn: new Date().toISOString() });
const fila = async (id) => (await pool.query('SELECT precio, stock, estado, version FROM producto WHERE id_producto = $1', [id])).rows[0];

/** Ejecuta SQL sin disparadores (para fijar actualizado_en en el pasado). */
async function sinDisparadores(sql, params) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SET LOCAL session_replication_role = 'replica'");
    await c.query(sql, params);
    await c.query('COMMIT');
  } finally {
    c.release();
  }
}
const envejecer = () => sinDisparadores("UPDATE producto SET actualizado_en = now() - interval '1 day'; UPDATE pedido SET actualizado_en = now() - interval '1 day'");

let rosa; let luis; let andres; let papa; let cebolla;

beforeAll(async () => { await migrate({ log: () => {} }); });

beforeEach(async () => {
  await vaciarUsuarios(pool);
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  luis = await cuenta('Luis', 'PRODUCTOR', '3105559999', 'Ocaña');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
  cebolla = await producto(luis.token, { nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, stock: 40, municipio: 'Ocaña' });
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('POST /api/v1/sync/push (CU-17 pasos 3–4)', () => {
  test('aplica una edición encolada y devuelve la publicación vigente', async () => {
    const op = editar(papa.id, { precio: 90000, stock: 15, version: 1 });
    const res = await push(rosa.token, [op]);
    expect(res.status).toBe(200);
    expect(res.body.resultados).toEqual([expect.objectContaining({ idOperacion: op.idOperacion, resultado: 'PUBLICADO' })]);
    expect(res.body.resultados[0].producto).toMatchObject({ id: papa.id, precio: 90000, stock: 15, version: 2 });
    expect(await fila(papa.id)).toMatchObject({ precio: '90000.00', stock: '15.00', version: 2 });
  });

  test('RNF-03: el reenvío de la misma operación responde YA_APLICADA sin aplicarla dos veces', async () => {
    const op = editar(papa.id, { stock: 12, version: 1 });
    await push(rosa.token, [op]);
    const res = await push(rosa.token, [op]);
    expect(res.body.resultados[0]).toMatchObject({ resultado: 'YA_APLICADA', producto: { stock: 12, version: 2 } });
    expect((await fila(papa.id)).version).toBe(2);
  });

  test('reenvíos simultáneos de la misma operación se serializan', async () => {
    const op = editar(papa.id, { stock: 7, version: 1 });
    const [a, b] = await Promise.all([push(rosa.token, [op]), push(rosa.token, [op])]);
    expect([a.body.resultados[0].resultado, b.body.resultados[0].resultado].sort()).toEqual(['PUBLICADO', 'YA_APLICADA']);
    expect((await fila(papa.id)).version).toBe(2);
  });

  test('CU-17 A2: con conflicto de versión prevalece el servidor y la operación queda CON_ERROR', async () => {
    await patch(rosa.token, `/productos/${papa.id}`, { precio: 95000, version: 1 }); // cambio hecho desde otro teléfono
    const op = editar(papa.id, { precio: 80000, version: 1 });
    const res = await push(rosa.token, [op]);
    expect(res.body.resultados[0]).toMatchObject({
      resultado: 'CON_ERROR',
      error: { codigo: 'CONFLICTO_VERSION', detalles: { producto: { precio: 95000, version: 2 } } },
    });
    expect(await fila(papa.id)).toMatchObject({ precio: '95000.00', version: 2 });
    // El reenvío devuelve el mismo rechazo (registrado).
    expect((await push(rosa.token, [op])).body.resultados[0]).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'CONFLICTO_VERSION' } });
  });

  test('aplica el lote en orden: ediciones encadenadas de la misma publicación', async () => {
    const res = await push(rosa.token, [editar(papa.id, { stock: 18, version: 1 }), editar(papa.id, { stock: 0, version: 2 })]);
    expect(res.body.resultados.map((r) => r.resultado)).toEqual(['PUBLICADO', 'PUBLICADO']);
    expect(await fila(papa.id)).toMatchObject({ stock: '0.00', estado: 'AGOTADA', version: 3 });
  });

  test('CU-17 A1: cada operación rechazada trae su motivo y no afecta a las demás', async () => {
    const res = await push(rosa.token, [
      editar(papa.id, { precio: -5, version: 1 }),
      editar(cebolla.id, { stock: 1, version: 1 }),
      { idOperacion: uuid(), tipo: 'PRODUCTO.BORRAR', idEntidad: papa.id, datos: {} },
      editar(papa.id, { stock: 19, version: 1 }),
    ]);
    expect(res.body.resultados.map((r) => [r.resultado, r.error && r.error.codigo])).toEqual([
      ['CON_ERROR', 'DATOS_INVALIDOS'],
      ['CON_ERROR', 'NO_ENCONTRADO'], // publicación de otro productor: no se revela
      ['CON_ERROR', 'DATOS_INVALIDOS'],
      ['PUBLICADO', undefined],
    ]);
    expect((await fila(cebolla.id)).stock).toBe('40.00');
  });

  test('un consumidor no puede editar publicaciones', async () => {
    const res = await push(andres.token, [editar(papa.id, { stock: 1, version: 1 })]);
    expect(res.body.resultados[0]).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'SIN_PERMISO' } });
  });

  test('un idOperacion usado por otro usuario se rechaza', async () => {
    const op = editar(papa.id, { stock: 3, version: 1 });
    await push(rosa.token, [op]);
    const res = await push(luis.token, [editar(cebolla.id, { stock: 3, version: 1 }, op.idOperacion)]);
    expect(res.body.resultados[0]).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'ID_EN_USO' } });
    expect((await fila(cebolla.id)).version).toBe(1);
  });

  test.each([
    ['sin operaciones', []],
    ['más de 50', Array.from({ length: 51 }, () => ({ idOperacion: uuid(), tipo: 'PRODUCTO.EDITAR' }))],
    ['idOperacion inválido', [{ idOperacion: '123', tipo: 'PRODUCTO.EDITAR' }]],
  ])('400 con un lote mal formado: %s', async (_caso, ops) => {
    const res = await push(rosa.token, ops);
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('DATOS_INVALIDOS');
  });

  test('401 sin token', async () => {
    expect((await request(app).post('/api/v1/sync/push').send({ operaciones: [] })).status).toBe(401);
  });
});

describe('GET /api/v1/sync/pull (CU-17 paso 4)', () => {
  test('primera sincronización: copia completa del catálogo visible y de los pedidos del usuario', async () => {
    await pool.query("UPDATE producto SET estado = 'PAUSADA' WHERE id_producto = $1", [cebolla.id]);
    const otra = await producto(luis.token, { nombre: 'Plátano hartón', categoria: 'PLATANO', unidad: 'unidad', precio: 900, stock: 100 });
    await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] });

    const res = await get(andres.token, '/sync/pull');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ completa: true, hayMas: false, siguiente: null, retirados: [] });
    expect(Date.parse(res.body.servidorEn)).not.toBeNaN();
    expect(res.body.productos.map((p) => p.id).sort()).toEqual([papa.id, otra.id].sort()); // la pausada no
    expect(res.body.pedidos).toHaveLength(1);
    expect(res.body.pedidos[0]).toMatchObject({ estado: 'PENDIENTE', total: 85000 });

    // El productor recibe también sus publicaciones no visibles en el catálogo.
    const luisPull = await get(luis.token, '/sync/pull');
    expect(luisPull.body.productos.map((p) => p.id)).toEqual(expect.arrayContaining([cebolla.id, otra.id, papa.id]));
  });

  test('sincronización incremental: solo lo cambiado, lo retirado y los pedidos actualizados', async () => {
    const pedido = (await confirmar(andres.token, uuid(), { items: [{ idProducto: cebolla.id, cantidad: 2 }] })).body.pedidos[0];
    await envejecer();
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    expect((await get(andres.token, `/sync/pull?desde=${desde}`)).body).toMatchObject({ completa: false, productos: [], retirados: [], pedidos: [] });

    await patch(rosa.token, `/productos/${papa.id}`, { precio: 88000, version: 1 });
    await pool.query("UPDATE producto SET estado = 'INACTIVA' WHERE id_producto = $1", [cebolla.id]);
    await patch(luis.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO', version: pedido.version });

    const res = await get(andres.token, `/sync/pull?desde=${desde}`);
    expect(res.body.productos.map((p) => [p.id, p.precio])).toEqual([[papa.id, 88000]]);
    expect(res.body.retirados).toEqual([cebolla.id]);
    expect(res.body.pedidos.map((p) => [p.id, p.estado])).toEqual([[pedido.id, 'ACEPTADO']]);
  });

  test('el solapamiento de 2 minutos recupera cambios confirmados justo antes de la marca', async () => {
    await envejecer();
    await sinDisparadores("UPDATE producto SET actualizado_en = now() - interval '90 seconds', precio = 87000 WHERE id_producto = $1", [papa.id]);
    const marca = new Date(Date.now() - 30 * 1000).toISOString(); // marca posterior al cambio
    const res = await get(andres.token, `/sync/pull?desde=${marca}`);
    expect(res.body.productos.map((p) => p.id)).toEqual([papa.id]);
  });

  test('pagina los productos de a 500 con cursor; los pedidos van solo en la primera página', async () => {
    await pool.query(
      `INSERT INTO producto (id_producto, id_productor, nombre, categoria, precio, unidad_medida, stock, foto_url, municipio)
       SELECT gen_random_uuid(), $1, 'Lote ' || g, 'OTROS', 1000, 'kg', 5, 'productos/x.jpg', 'Pamplonita' FROM generate_series(1, 505) g`,
      [rosa.id],
    );
    const p1 = await get(andres.token, '/sync/pull');
    expect(p1.body.productos).toHaveLength(500);
    expect(p1.body.hayMas).toBe(true);
    expect(p1.body.pedidos).toEqual([]);
    const { desde, despuesDe } = p1.body.siguiente;
    const p2 = await get(andres.token, `/sync/pull?desde=${encodeURIComponent(desde)}&despuesDe=${despuesDe}`);
    expect(p2.body.productos).toHaveLength(7); // 505 + papa + cebolla
    expect(p2.body.hayMas).toBe(false);
    expect(p2.body.pedidos).toBeUndefined();
    const ids = new Set([...p1.body.productos, ...p2.body.productos].map((p) => p.id));
    expect(ids.size).toBe(507);
  });

  test('400 con parámetros inválidos', async () => {
    expect((await get(andres.token, '/sync/pull?desde=ayer')).status).toBe(400);
    expect((await get(andres.token, `/sync/pull?despuesDe=${uuid()}`)).status).toBe(400);
  });
});
