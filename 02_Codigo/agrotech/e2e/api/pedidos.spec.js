// CU-04, CU-13, CU-15 · Pedidos (caja negra: solo HTTP y WebSocket)
const { test, expect } = require('@playwright/test');
const {
  auth, uuid, json, crearCuenta, publicar, pedir, cambiarEstado, conectarWs,
} = require('../soporte/api');

const stock = async (request, token, id) => (await json(await request.get(`productos/${id}`, { headers: auth(token) }))).producto.stock;
const esperarHasta = async (condicion, ms = 5000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (condicion()) return; await new Promise((r) => setTimeout(r, 25)); }
  throw new Error('Tiempo agotado esperando la condición');
};

test.describe('CU-04 · Confirmar pedido', () => {
  test('CP-06: con stock suficiente se descuenta, queda «Pendiente» y el productor recibe el aviso', { tag: '@CP-06' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request, { municipio: 'Cúcuta' });
    const papa = await publicar(request, rosa.token, { precio: 85000, stock: 20 });
    const ws = await conectarWs(rosa.token);
    try {
      const inicio = Date.now();
      const r = await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }]);
      expect(r.status()).toBe(201);
      const [pedido] = (await json(r)).pedidos;
      expect(pedido).toMatchObject({ estado: 'PENDIENTE', total: 170000, metodoPago: 'CONTRA_ENTREGA' });
      expect(pedido.items[0]).toMatchObject({ idProducto: papa.id, cantidad: 2, precioUnitario: 85000, subtotal: 170000 });
      expect(await stock(request, andres.token, papa.id)).toBe(18);

      await esperarHasta(() => ws.recibidos.some((m) => m.tipo === 'pedido_nuevo' && m.idPedido === pedido.id));
      const aviso = ws.recibidos.find((m) => m.tipo === 'pedido_nuevo');
      test.info().annotations.push({ type: 'medición', description: `Aviso «pedido_nuevo» al productor en ${aviso.recibidoEn - inicio} ms` });
    } finally { ws.close(); }
  });

  test('CP-07: dos consumidores compran a la vez la última unidad; solo uno lo logra', { tag: '@CP-07' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const [andres, maria] = await Promise.all([crearCuenta(request), crearCuenta(request)]);
    const mora = await publicar(request, rosa.token, { nombre: 'Mora de castilla', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 1 });

    const [a, b] = await Promise.all([
      pedir(request, andres.token, [{ idProducto: mora.id, cantidad: 1 }]),
      pedir(request, maria.token, [{ idProducto: mora.id, cantidad: 1 }]),
    ]);
    expect([a.status(), b.status()].sort()).toEqual([201, 409]);
    const perdedor = a.status() === 409 ? a : b;
    const error = (await json(perdedor)).error;
    expect(error.codigo).toBe('STOCK_INSUFICIENTE');
    expect(error.detalles.productos).toEqual([expect.objectContaining({ idProducto: mora.id, disponible: 0, solicitado: 1 })]);

    const detalle = (await json(await request.get(`productos/${mora.id}`, { headers: auth(maria.token) }))).producto;
    expect(detalle).toMatchObject({ stock: 0, estado: 'AGOTADA' });
    const pedidosRosa = (await json(await request.get('pedidos', { headers: auth(rosa.token) }))).pedidos;
    expect(pedidosRosa).toHaveLength(1);
  });

  test('CP-16: reenviar con la misma Idempotency-Key devuelve el mismo comprobante y descuenta una vez', { tag: '@CP-16' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token, { stock: 20 });
    const items = [{ idProducto: papa.id, cantidad: 2 }];

    const clave = uuid();
    const r1 = await pedir(request, andres.token, items, { clave });
    const r2 = await pedir(request, andres.token, items, { clave });
    expect(r1.status()).toBe(201);
    expect(r2.status()).toBe(200);
    expect((await json(r2)).pedidos.map((p) => p.id)).toEqual((await json(r1)).pedidos.map((p) => p.id));
    expect(await stock(request, andres.token, papa.id)).toBe(18);

    // Reintentos simultáneos (doble toque o red que reenvía): un solo pedido.
    const clave2 = uuid();
    const [a, b] = await Promise.all([pedir(request, andres.token, items, { clave: clave2 }), pedir(request, andres.token, items, { clave: clave2 })]);
    expect([a.status(), b.status()].sort()).toEqual([200, 201]);
    expect(await stock(request, andres.token, papa.id)).toBe(16);
    expect((await json(await request.get('pedidos?estado=todos', { headers: auth(andres.token) }))).pedidos).toHaveLength(2);
  });
});

test.describe('CU-13 · Estados del pedido', () => {
  test('CP-08: avanza por todos los estados con fecha y el salto se bloquea', { tag: '@CP-08' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token);
    let [pedido] = (await json(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]))).pedidos;

    // Salto Pendiente → Entregado: bloqueado.
    const salto = await cambiarEstado(request, rosa.token, pedido, 'ENTREGADO');
    expect(salto.status()).toBe(409);
    expect((await json(salto)).error.codigo).toBe('TRANSICION_NO_PERMITIDA');

    for (const estado of ['ACEPTADO', 'EN_CAMINO']) {
      const r = await cambiarEstado(request, rosa.token, pedido, estado);
      expect(r.status()).toBe(200);
      pedido = (await json(r)).pedido;
      expect(pedido.estado).toBe(estado);
    }
    // Retroceso En camino → Aceptado: bloqueado.
    expect((await cambiarEstado(request, rosa.token, pedido, 'ACEPTADO')).status()).toBe(409);
    // El consumidor no cambia estados.
    expect((await cambiarEstado(request, andres.token, pedido, 'ENTREGADO')).status()).toBe(403);
    pedido = (await json(await cambiarEstado(request, rosa.token, pedido, 'ENTREGADO'))).pedido;
    expect(pedido.estado).toBe('ENTREGADO');

    const d = (await json(await request.get(`pedidos/${pedido.id}`, { headers: auth(andres.token) }))).pedido;
    expect(d.historial.map((h) => h.estadoNuevo)).toEqual(['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'ENTREGADO']);
    const fechas = d.historial.map((h) => Date.parse(h.fecha));
    expect(fechas.every((f) => !Number.isNaN(f))).toBe(true);
    expect([...fechas].sort((x, y) => x - y)).toEqual(fechas);
  });
});

test.describe('CU-15 · Mis pedidos', () => {
  test('CP-14: aparecen los pedidos activos con su estado vigente', { tag: '@CP-14' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token, { stock: 30 });
    const crear = async () => (await json(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]))).pedidos[0];
    const pendiente = await crear();
    let aceptado = await crear();
    let entregado = await crear();
    let cancelado = await crear();
    aceptado = (await json(await cambiarEstado(request, rosa.token, aceptado, 'ACEPTADO'))).pedido;
    for (const e of ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO']) entregado = (await json(await cambiarEstado(request, rosa.token, entregado, e))).pedido;
    cancelado = (await json(await cambiarEstado(request, rosa.token, cancelado, 'CANCELADO', { motivo: 'Sin transporte' }))).pedido;
    expect(cancelado.estado).toBe('CANCELADO');

    const activos = (await json(await request.get('pedidos?estado=activos', { headers: auth(andres.token) }))).pedidos;
    const vistos = Object.fromEntries(activos.map((p) => [p.id, p.estado]));
    expect(vistos).toEqual({ [pendiente.id]: 'PENDIENTE', [aceptado.id]: 'ACEPTADO' });
    expect(activos.every((p) => p.actualizadoEn)).toBe(true);
    expect((await json(await request.get('pedidos?estado=todos', { headers: auth(andres.token) }))).pedidos).toHaveLength(4);
    // Otro consumidor no ve pedidos ajenos.
    const maria = await crearCuenta(request);
    expect((await json(await request.get('pedidos?estado=todos', { headers: auth(maria.token) }))).pedidos).toEqual([]);
    expect((await request.get(`pedidos/${pendiente.id}`, { headers: auth(maria.token) })).status()).toBe(404);
  });
});
