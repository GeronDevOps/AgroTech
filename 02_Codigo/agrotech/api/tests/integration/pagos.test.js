'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const request = require('supertest');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { crearAyudas, eventoWompi } = require('./ayudas');
const { vaciarUsuarios } = require('./limpiar');

const app = createApp({ pool });
const { cuenta, producto, confirmar, get, patch, post } = crearAyudas(app);
const SECRETO = config.wompi.secretoEventos;
const enviarEvento = (evento) => request(app).post('/api/v1/pagos/wompi/eventos').send(evento);

let rosa; let andres; let papa; let pedido;

beforeAll(async () => { await migrate({ log: () => {} }); });

beforeEach(async () => {
  await vaciarUsuarios(pool);
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
  const r = await confirmar(andres.token, crypto.randomUUID(), { items: [{ idProducto: papa.id, cantidad: 2 }], metodoPago: 'EN_LINEA' });
  pedido = r.body.pedidos[0];
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

async function iniciarPago() {
  const r = await post(andres.token, `/pedidos/${pedido.id}/pago`);
  return { ...r.body, status: r.status, url: r.body.urlCheckout && new URL(r.body.urlCheckout) };
}

describe('POST /api/v1/pedidos/{id}/pago (CU-22)', () => {
  test('el pedido en línea nace con pago pendiente y el productor no puede aceptarlo', async () => {
    expect(pedido).toMatchObject({ metodoPago: 'EN_LINEA', estadoPago: 'PENDIENTE' });
    const r = await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('PAGO_NO_APROBADO');
  });

  test('devuelve la URL del checkout con monto calculado en el servidor y firma de integridad', async () => {
    const r = await iniciarPago();
    expect(r.status).toBe(201);
    const q = r.url.searchParams;
    expect(`${r.url.origin}${r.url.pathname}`).toBe('https://checkout.wompi.co/p/');
    expect(q.get('public-key')).toBe(config.wompi.llavePublica);
    expect(q.get('currency')).toBe('COP');
    expect(q.get('amount-in-cents')).toBe('17000000');          // 2 × 85.000 × 100
    const esperada = crypto.createHash('sha256').update(`${q.get('reference')}17000000COP${config.wompi.secretoIntegridad}`).digest('hex');
    expect(q.get('signature:integrity')).toBe(esperada);
    // reintentar reutiliza el mismo intento vigente
    const otra = await iniciarPago();
    expect(otra.status).toBe(200);
    expect(otra.pago.referencia).toBe(r.pago.referencia);
  });

  test('un pedido contra entrega no se paga en línea', async () => {
    const r = await confirmar(andres.token, crypto.randomUUID(), { items: [{ idProducto: papa.id, cantidad: 1 }] });
    const p = await post(andres.token, `/pedidos/${r.body.pedidos[0].id}/pago`);
    expect(p.status).toBe(409);
    expect(p.body.error.codigo).toBe('METODO_CONTRA_ENTREGA');
  });
});

describe('POST /api/v1/pagos/wompi/eventos', () => {
  test('CP-18 (aprobada): el evento firmado aprueba el pago y el productor ya puede aceptar; un repetido no se reprocesa', async () => {
    const { pago } = await iniciarPago();
    const evento = eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: SECRETO, metodo: 'NEQUI' });
    const r = await enviarEvento(evento);
    expect(r.status).toBe(200);
    expect(r.body.resultado).toBe('ACTUALIZADO');
    const d = await get(andres.token, `/pedidos/${pedido.id}`);
    expect(d.body.pedido).toMatchObject({ estadoPago: 'APROBADO', pago: { estado: 'APROBADA', medio: 'NEQUI' } });
    expect((await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO' })).status).toBe(200);

    expect((await enviarEvento(evento)).body.resultado).toBe('REPETIDO');
    const bit = await pool.query("SELECT count(*)::int AS n FROM bitacora WHERE accion = 'PAGO_APROBADA'");
    expect(bit.rows[0].n).toBe(1);
  });

  test('CP-18 (rechazada): queda rechazado; se puede reintentar con otra referencia o cambiar a contra entrega', async () => {
    const { pago } = await iniciarPago();
    await enviarEvento(eventoWompi({ status: 'DECLINED', reference: pago.referencia, amount: pago.montoCentavos, secreto: SECRETO }));
    expect((await get(andres.token, `/pedidos/${pedido.id}`)).body.pedido.estadoPago).toBe('RECHAZADO');

    const otro = await iniciarPago();
    expect(otro.status).toBe(201);
    expect(otro.pago.referencia).not.toBe(pago.referencia);
    await enviarEvento(eventoWompi({ status: 'DECLINED', reference: otro.pago.referencia, amount: otro.pago.montoCentavos, secreto: SECRETO }));

    const c = await patch(andres.token, `/pedidos/${pedido.id}/pago`, { metodoPago: 'CONTRA_ENTREGA' });
    expect(c.status).toBe(200);
    expect(c.body.pedido).toMatchObject({ metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA' });
    expect((await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO' })).status).toBe(200);
  });

  test('CP-19: firma alterada o ambiente distinto → 401 sin cambios', async () => {
    const { pago } = await iniciarPago();
    const alterado = eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: 'otro-secreto' });
    expect((await enviarEvento(alterado)).status).toBe(401);
    const prod = eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: SECRETO, environment: 'prod' });
    expect((await enviarEvento(prod)).status).toBe(401);
    const cambiado = eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: SECRETO });
    cambiado.data.transaction.status = 'APPROVED';
    cambiado.data.transaction.amount_in_cents = 100;   // monto alterado después de firmar
    expect((await enviarEvento(cambiado)).status).toBe(401);
    expect((await get(andres.token, `/pedidos/${pedido.id}`)).body.pedido.estadoPago).toBe('PENDIENTE');
  });

  test('un monto distinto al del pedido (aunque esté firmado) no aprueba el pago', async () => {
    const { pago } = await iniciarPago();
    const r = await enviarEvento(eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: 100, secreto: SECRETO }));
    expect(r.body.resultado).toBe('MONTO_DISTINTO');
    expect((await get(andres.token, `/pedidos/${pedido.id}`)).body.pedido.estadoPago).toBe('PENDIENTE');
  });

  test('con un pago en curso de menos de 30 min no se puede cambiar a contra entrega', async () => {
    await iniciarPago();
    const r = await patch(andres.token, `/pedidos/${pedido.id}/pago`, { metodoPago: 'CONTRA_ENTREGA' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('PAGO_EN_CURSO');
  });

  test('un pago aprobado tarde sobre un intento abandonado se registra y el pedido vuelve a "en línea"', async () => {
    const { pago } = await iniciarPago();
    await pool.query("UPDATE pago SET creado_en = now() - interval '31 minutes' WHERE referencia = $1", [pago.referencia]);
    expect((await patch(andres.token, `/pedidos/${pedido.id}/pago`, { metodoPago: 'CONTRA_ENTREGA' })).status).toBe(200);
    await enviarEvento(eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: SECRETO }));
    expect((await get(andres.token, `/pedidos/${pedido.id}`)).body.pedido).toMatchObject({ metodoPago: 'EN_LINEA', estadoPago: 'APROBADO' });
  });

  test('GET /pagos/retorno devuelve al usuario a la app', async () => {
    const r = await request(app).get('/api/v1/pagos/retorno?id=12345-abc');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('agrotech://pago?id=12345-abc');
  });
});
