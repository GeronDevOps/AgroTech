'use strict';

const fs = require('node:fs/promises');
const { migrate } = require('../../../src/db/migrate');
const config = require('../../../src/config/env');
const { entornoFase2, pool } = require('./comun');

const e = entornoFase2();
let rosa; let andres; let papa;
const stock = async () => (await e.get(rosa.token, `/productos/${papa.id}`)).body.producto.stock;

beforeAll(async () => { await migrate({ log: () => {} }); });
beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  papa = await e.producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
});
afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-14 · Cancelar un pedido (RF-14 · AGRO-26)', () => {
  test('CP-26: el consumidor cancela un pedido aceptado: inventario restituido, historial con motivo y chat en solo lectura', async () => {
    const p = await e.pedido(andres.token, papa.id, 3);
    expect(await stock()).toBe(17);
    await e.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'ACEPTADO' });

    const r = await e.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Ya no lo necesito' });
    expect(r.status).toBe(200);
    expect(r.body.pedido).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Consumidor: Ya no lo necesito' });
    expect(r.body.pedido.historial.map((h) => h.estadoNuevo)).toEqual(['PENDIENTE', 'ACEPTADO', 'CANCELADO']);
    expect(await stock()).toBe(20);
    const { rows: [h] } = await pool.query("SELECT id_usuario FROM historial_estado WHERE id_pedido = $1 AND estado_nuevo = 'CANCELADO'", [p.id]);
    expect(h.id_usuario).toBe(andres.id);
    const chat = await e.post(rosa.token, `/pedidos/${p.id}/mensajes`, { id: require('node:crypto').randomUUID(), contenido: '¿Por qué?' });
    expect(chat.status).toBe(409);
    expect(chat.body.error.codigo).toBe('CHAT_CERRADO');
    // La contraparte recibe el aviso (bandeja).
    await e.hasta(async () => (await e.get(rosa.token, '/notificaciones')).body.notificaciones.some((n) => n.tipo === 'PEDIDO_CANCELADO'));
  });

  test('el productor también puede cancelar un pedido en camino', async () => {
    const p = await e.pedido(andres.token, papa.id, 2);
    await e.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'ACEPTADO' });
    await e.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'EN_CAMINO' });
    const r = await e.post(rosa.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Se dañó el camión' });
    expect(r.body.pedido).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Productor: Se dañó el camión' });
    expect(await stock()).toBe(20);
  });

  test('A1: un pedido entregado no se puede cancelar (se usa un reporte)', async () => {
    const p = await e.pedido(andres.token, papa.id, 1);
    await e.entregar(rosa.token, p.id);
    const r = await e.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Llegó en mal estado' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('PEDIDO_ENTREGADO');
    expect((await e.get(andres.token, `/pedidos/${p.id}`)).body.pedido.acciones).toEqual(expect.arrayContaining(['REPORTAR', 'CALIFICAR']));
  });

  test('A2: cancelaciones simultáneas: prevalece la primera y el inventario se restituye una sola vez', async () => {
    const p = await e.pedido(andres.token, papa.id, 5);
    const [a, b] = await Promise.all([
      e.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Me equivoqué' }),
      e.post(rosa.token, `/pedidos/${p.id}/cancelar`, { motivo: 'No tengo papa' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find((x) => x.status === 409).body.error.codigo).toBe('YA_CANCELADO');
    expect(await stock()).toBe(20);
  });

  test('validaciones: sin motivo → 400; otro usuario → 404; doble cancelación → 409', async () => {
    const intruso = await e.cuenta('Maria', 'CONSUMIDOR', '3005550000');
    const p = await e.pedido(andres.token, papa.id, 1);
    expect((await e.post(andres.token, `/pedidos/${p.id}/cancelar`, {})).status).toBe(400);
    expect((await e.post(intruso.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Porque sí' })).status).toBe(404);
    await e.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Me equivoqué' });
    expect((await e.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Otra vez' })).body.error.codigo).toBe('YA_CANCELADO');
  });

  test('un pedido en línea sin pagar queda con el pago anulado', async () => {
    const p = await e.pedido(andres.token, papa.id, 1, { metodoPago: 'EN_LINEA' });
    const r = await e.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Prefiero no pagar en línea' });
    expect(r.body.pedido.estadoPago).toBe('ANULADO');
  });
});

describe('CU-15 · Historial de pedidos con filtros (RF-15 · AGRO-26)', () => {
  test('CP-27: activos, finalizados, por estado y por fechas, del más reciente al más antiguo', async () => {
    const p1 = await e.pedido(andres.token, papa.id, 1);
    const p2 = await e.pedido(andres.token, papa.id, 2);
    const p3 = await e.pedido(andres.token, papa.id, 3);
    await e.entregar(rosa.token, p1.id);
    await e.post(andres.token, `/pedidos/${p2.id}/cancelar`, { motivo: 'Me equivoqué' });
    await pool.query("UPDATE pedido SET fecha = '2026-09-15 10:00-05' WHERE id_pedido = $1", [p1.id]);

    const ids = async (q) => (await e.get(andres.token, `/pedidos?${new URLSearchParams(q)}`)).body.pedidos.map((x) => x.id);
    expect(await ids({})).toEqual([p3.id]); // activos por defecto
    expect(await ids({ estado: 'finalizados' })).toEqual([p2.id, p1.id]);
    expect(await ids({ estado: 'todos' })).toEqual([p3.id, p2.id, p1.id]);
    expect(await ids({ estado: 'CANCELADO' })).toEqual([p2.id]);
    expect(await ids({ estado: 'ENTREGADO,CANCELADO' })).toEqual([p2.id, p1.id]);
    expect(await ids({ estado: 'todos', desde: '2026-09-01', hasta: '2026-09-30' })).toEqual([p1.id]);
    const r = await e.get(andres.token, '/pedidos?estado=todos');
    expect(r.body).toMatchObject({ pagina: 1, total: 3, hayMas: false });
    expect((await e.get(andres.token, '/pedidos?estado=PERDIDO')).status).toBe(400);
    expect((await e.get(andres.token, '/pedidos?desde=15-09-2026')).status).toBe(400);
  });

  test('paso 3: el detalle trae productos, precio pactado, historial y acciones disponibles', async () => {
    const p = await e.pedido(andres.token, papa.id, 2);
    await e.patch(rosa.token, `/productos/${papa.id}`, { precio: 90000, version: (await e.get(rosa.token, `/productos/${papa.id}`)).body.producto.version });
    const d = (await e.get(andres.token, `/pedidos/${p.id}`)).body.pedido;
    expect(d.items[0]).toMatchObject({ precioUnitario: 85000, subtotal: 170000 });
    expect(d.acciones).toEqual(['CHAT', 'CANCELAR', 'REPORTAR']);
    expect((await e.get(rosa.token, `/pedidos/${p.id}`)).body.pedido.acciones).toEqual(['CHAT', 'CANCELAR', 'ACEPTAR', 'RECHAZAR', 'REPORTAR']);
  });
});
