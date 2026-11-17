'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { crearAyudas } = require('./ayudas');

const app = createApp({ pool });
const { cuenta, producto, confirmar, get, patch } = crearAyudas(app);
const uuid = () => crypto.randomUUID();
const stock = async (id) => Number((await pool.query('SELECT stock FROM producto WHERE id_producto = $1', [id])).rows[0].stock);

let rosa; let luis; let andres; let maria; let papa; let mora; let cebolla;

beforeAll(async () => { await migrate({ log: () => {} }); });

beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  luis = await cuenta('Luis', 'PRODUCTOR', '3105559999', 'Ocaña');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  maria = await cuenta('Maria', 'CONSUMIDOR', '3205551111', 'Cúcuta');
  papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
  mora = await producto(rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 5 });
  cebolla = await producto(luis.token, { nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, stock: 40, municipio: 'Ocaña' });
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('POST /api/v1/pedidos (CU-04)', () => {
  test('CP-06: crea un pedido por productor con el precio pactado y descuenta el stock', async () => {
    const res = await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 2 }, { idProducto: cebolla.id, cantidad: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.pedidos).toHaveLength(2);
    const porProductor = Object.fromEntries(res.body.pedidos.map((p) => [p.productor.id, p]));
    expect(porProductor[rosa.id]).toMatchObject({ estado: 'PENDIENTE', total: 170000, metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA', franjaEntrega: 'Mañana' });
    expect(porProductor[rosa.id].items).toEqual([{ idProducto: papa.id, nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 2, precioUnitario: 85000, subtotal: 170000 }]);
    expect(porProductor[luis.id].total).toBe(96000);
    expect(await stock(papa.id)).toBe(18);
    expect(await stock(cebolla.id)).toBe(37);
    const h = await pool.query('SELECT estado_anterior, estado_nuevo, id_usuario FROM historial_estado WHERE id_pedido = $1', [porProductor[rosa.id].id]);
    expect(h.rows).toEqual([{ estado_anterior: null, estado_nuevo: 'PENDIENTE', id_usuario: andres.id }]);
  });

  test('CP-16: reenviar con la misma Idempotency-Key devuelve el mismo comprobante sin efectos nuevos', async () => {
    const clave = uuid();
    const cuerpo = { items: [{ idProducto: papa.id, cantidad: 2 }] };
    const r1 = await confirmar(andres.token, clave, cuerpo);
    const r2 = await confirmar(andres.token, clave, cuerpo);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body.pedidos.map((p) => p.id)).toEqual(r1.body.pedidos.map((p) => p.id));
    expect(await stock(papa.id)).toBe(18);
    // también con dos reintentos simultáneos
    const clave2 = uuid();
    const [a, b] = await Promise.all([confirmar(andres.token, clave2, cuerpo), confirmar(andres.token, clave2, cuerpo)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(await stock(papa.id)).toBe(16);
  });

  test('A1: stock insuficiente revierte todo el carrito e indica qué ajustar', async () => {
    const res = await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }, { idProducto: mora.id, cantidad: 6 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe('STOCK_INSUFICIENTE');
    expect(res.body.error.detalles.productos).toEqual([{ idProducto: mora.id, nombre: 'Mora', disponible: 5, solicitado: 6 }]);
    expect(await stock(papa.id)).toBe(20);
    expect((await pool.query('SELECT count(*)::int AS n FROM pedido')).rows[0].n).toBe(0);
  });

  test('CP-07: dos consumidores compran las últimas unidades al mismo tiempo: uno gana, el stock nunca es negativo', async () => {
    const cuerpo = { items: [{ idProducto: mora.id, cantidad: 4 }] };
    const [a, b] = await Promise.all([confirmar(andres.token, uuid(), cuerpo), confirmar(maria.token, uuid(), cuerpo)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await stock(mora.id)).toBe(1);
  });

  test('al llegar a 0 la publicación queda Agotada y sale del catálogo', async () => {
    await confirmar(andres.token, uuid(), { items: [{ idProducto: mora.id, cantidad: 5 }] });
    const { rows } = await pool.query('SELECT estado, stock FROM producto WHERE id_producto = $1', [mora.id]);
    expect(rows[0]).toEqual({ estado: 'AGOTADA', stock: '0.00' });
    expect((await get(maria.token, '/productos')).body.productos.map((p) => p.id)).not.toContain(mora.id);
  });

  test('validaciones: sin Idempotency-Key, carrito vacío o franja inválida → 400; productor → 403', async () => {
    expect((await confirmar(andres.token, null, { items: [{ idProducto: papa.id, cantidad: 1 }] })).status).toBe(400);
    const vacio = await confirmar(andres.token, uuid(), { items: [], franjaEntrega: 'NOCHE' });
    expect(Object.keys(vacio.body.error.detalles.campos)).toEqual(expect.arrayContaining(['items', 'franjaEntrega']));
    expect((await confirmar(rosa.token, uuid(), { items: [{ idProducto: cebolla.id, cantidad: 1 }] })).status).toBe(403);
  });
});

describe('PATCH /api/v1/pedidos/{id}/estado (CU-13)', () => {
  let pedido;
  beforeEach(async () => {
    const r = await confirmar(andres.token, uuid(), { items: [{ idProducto: mora.id, cantidad: 5 }] });
    pedido = r.body.pedidos[0];
  });

  test('CP-08: avanza Pendiente → Aceptado → En camino → Entregado con historial', async () => {
    for (const estado of ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO']) {
      const r = await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado });
      expect(r.status).toBe(200);
      expect(r.body.pedido.estado).toBe(estado);
    }
    const d = await get(andres.token, `/pedidos/${pedido.id}`);
    expect(d.body.pedido.historial.map((h) => h.estadoNuevo)).toEqual(['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'ENTREGADO']);
  });

  test('un salto de estado se rechaza con 409', async () => {
    const r = await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'ENTREGADO' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('TRANSICION_NO_PERMITIDA');
  });

  test('A1: el rechazo exige motivo y restituye el inventario (Agotada → Activa)', async () => {
    expect((await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'CANCELADO' })).status).toBe(400);
    const r = await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'CANCELADO', motivo: 'Se dañó la cosecha' });
    expect(r.body.pedido).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Se dañó la cosecha' });
    const { rows } = await pool.query('SELECT estado, stock FROM producto WHERE id_producto = $1', [mora.id]);
    expect(rows[0]).toEqual({ estado: 'ACTIVA', stock: '5.00' });
  });

  test('solo el productor del pedido: otro productor → 404, consumidor → 403', async () => {
    expect((await patch(luis.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO' })).status).toBe(404);
    expect((await patch(andres.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO' })).status).toBe(403);
    expect((await get(maria.token, `/pedidos/${pedido.id}`)).status).toBe(404);
  });

  test('CU-13 A3: la tarea programada cancela los pendientes de más de 48 h y restituye el stock', async () => {
    await pool.query("UPDATE pedido SET fecha = now() - interval '49 hours' WHERE id_pedido = $1", [pedido.id]);
    const ids = await app.locals.servicios.pedidosService.cancelarVencidos({ horas: 48 });
    expect(ids).toEqual([pedido.id]);
    expect(await stock(mora.id)).toBe(5);
    const h = await pool.query("SELECT id_usuario FROM historial_estado WHERE id_pedido = $1 AND estado_nuevo = 'CANCELADO'", [pedido.id]);
    expect(h.rows).toEqual([{ id_usuario: null }]);
  });
});

describe('GET /api/v1/pedidos (CU-15)', () => {
  test('CP-14: el consumidor ve sus pedidos activos con estado y fecha del último cambio; el productor los recibidos', async () => {
    const r1 = await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] });
    const r2 = await confirmar(andres.token, uuid(), { items: [{ idProducto: mora.id, cantidad: 1 }] });
    await patch(rosa.token, `/pedidos/${r1.body.pedidos[0].id}/estado`, { estado: 'ACEPTADO' });
    for (const e of ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO']) await patch(rosa.token, `/pedidos/${r2.body.pedidos[0].id}/estado`, { estado: e });

    const activos = (await get(andres.token, '/pedidos?estado=activos')).body.pedidos;
    expect(activos.map((p) => [p.id, p.estado])).toEqual([[r1.body.pedidos[0].id, 'ACEPTADO']]);
    expect(activos[0].actualizadoEn).toBeDefined();
    expect((await get(andres.token, '/pedidos?estado=todos')).body.pedidos).toHaveLength(2);
    expect((await get(rosa.token, '/pedidos')).body.pedidos.map((p) => p.consumidor.nombre)).toEqual(['Andres P.']);
    expect((await get(luis.token, '/pedidos')).body.pedidos).toEqual([]);
  });
});
