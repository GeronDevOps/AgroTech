// CU-22 · Pago en línea con Wompi (caja negra). Los eventos se firman con el secreto de eventos del entorno
// probado, igual que los que envía el sandbox de Wompi tras pagar con sus tarjetas de prueba.
const { test, expect } = require('@playwright/test');
const {
  auth, json, crearCuenta, publicar, pedir, cambiarEstado, eventoWompi,
} = require('../soporte/api');
const { WOMPI_SECRETO_EVENTOS } = require('../entorno');

test.skip(!WOMPI_SECRETO_EVENTOS, 'Defina E2E_WOMPI_SECRETO_EVENTOS para probar los pagos contra un servidor desplegado');

async function pedidoEnLinea(request) {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token, { precio: 85000, stock: 20 });
  const r = await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }], { metodoPago: 'EN_LINEA' });
  expect(r.status()).toBe(201);
  const [pedido] = (await json(r)).pedidos;
  expect(pedido).toMatchObject({ metodoPago: 'EN_LINEA', estadoPago: 'PENDIENTE' });
  return { rosa, andres, pedido };
}

const iniciarPago = async (request, token, pedido) => {
  const r = await request.post(`pedidos/${pedido.id}/pago`, { headers: auth(token) });
  return { status: r.status(), ...(await json(r)) };
};
const enviarEvento = (request, evento) => request.post('pagos/wompi/eventos', { data: evento });
const detalle = async (request, token, pedido) => (await json(await request.get(`pedidos/${pedido.id}`, { headers: auth(token) }))).pedido;

test.describe('CU-22 · Pago en línea', () => {
  test('CP-18 (aprobada): el pago queda aprobado y el productor puede aceptar', { tag: '@CP-18' }, async ({ request }) => {
    const { rosa, andres, pedido } = await pedidoEnLinea(request);
    // Sin pago aprobado el productor no puede aceptar.
    const antes = await cambiarEstado(request, rosa.token, pedido, 'ACEPTADO');
    expect(antes.status()).toBe(409);
    expect((await json(antes)).error.codigo).toBe('PAGO_NO_APROBADO');

    const { status, pago, urlCheckout } = await iniciarPago(request, andres.token, pedido);
    expect(status).toBe(201);
    const url = new URL(urlCheckout);
    expect(url.searchParams.get('amount-in-cents')).toBe('17000000'); // monto calculado en el servidor
    expect(url.searchParams.get('signature:integrity')).toMatch(/^[0-9a-f]{64}$/);

    const r = await enviarEvento(request, eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: WOMPI_SECRETO_EVENTOS }));
    expect(r.status()).toBe(200);
    expect((await json(r)).resultado).toBe('ACTUALIZADO');
    expect(await detalle(request, andres.token, pedido)).toMatchObject({ estadoPago: 'APROBADO', pago: { estado: 'APROBADA' } });
    expect((await cambiarEstado(request, rosa.token, await detalle(request, rosa.token, pedido), 'ACEPTADO')).status()).toBe(200);
  });

  test('CP-18 (rechazada): se puede reintentar con otra referencia o cambiar a contra entrega', { tag: '@CP-18' }, async ({ request }) => {
    const { rosa, andres, pedido } = await pedidoEnLinea(request);
    const primero = await iniciarPago(request, andres.token, pedido);
    await enviarEvento(request, eventoWompi({ status: 'DECLINED', reference: primero.pago.referencia, amount: primero.pago.montoCentavos, secreto: WOMPI_SECRETO_EVENTOS }));
    expect((await detalle(request, andres.token, pedido)).estadoPago).toBe('RECHAZADO');

    const reintento = await iniciarPago(request, andres.token, pedido);
    expect(reintento.status).toBe(201);
    expect(reintento.pago.referencia).not.toBe(primero.pago.referencia);
    await enviarEvento(request, eventoWompi({ status: 'DECLINED', reference: reintento.pago.referencia, amount: reintento.pago.montoCentavos, secreto: WOMPI_SECRETO_EVENTOS }));

    const cambio = await request.patch(`pedidos/${pedido.id}/pago`, { headers: auth(andres.token), data: { metodoPago: 'CONTRA_ENTREGA' } });
    expect(cambio.status()).toBe(200);
    expect((await json(cambio)).pedido).toMatchObject({ metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA' });
    expect((await cambiarEstado(request, rosa.token, await detalle(request, rosa.token, pedido), 'ACEPTADO')).status()).toBe(200);
  });

  test('CP-19: firma alterada → 401 sin cambios; evento repetido → no se reprocesa', { tag: '@CP-19' }, async ({ request }) => {
    const { andres, pedido } = await pedidoEnLinea(request);
    const { pago } = await iniciarPago(request, andres.token, pedido);
    const base = { status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos };

    // 1. Firmado con otro secreto.
    expect((await enviarEvento(request, eventoWompi({ ...base, secreto: 'secreto-de-un-atacante' }))).status()).toBe(401);
    // 2. Firmado bien, pero el monto se alteró después de firmar.
    const alterado = eventoWompi({ ...base, secreto: WOMPI_SECRETO_EVENTOS });
    alterado.data.transaction.amount_in_cents = 100;
    expect((await enviarEvento(request, alterado)).status()).toBe(401);
    // 3. Sin firma.
    const sinFirma = eventoWompi({ ...base, secreto: WOMPI_SECRETO_EVENTOS });
    delete sinFirma.signature;
    expect((await enviarEvento(request, sinFirma)).status()).toBe(401);
    expect((await detalle(request, andres.token, pedido)).estadoPago).toBe('PENDIENTE');

    // Evento válido y luego el mismo evento repetido (Wompi reintenta si no recibe 200 a tiempo).
    const valido = eventoWompi({ ...base, secreto: WOMPI_SECRETO_EVENTOS });
    expect((await json(await enviarEvento(request, valido))).resultado).toBe('ACTUALIZADO');
    const repetido = await enviarEvento(request, valido);
    expect(repetido.status()).toBe(200);
    expect((await json(repetido)).resultado).toBe('REPETIDO');
    expect((await detalle(request, andres.token, pedido)).estadoPago).toBe('APROBADO');
  });
});
