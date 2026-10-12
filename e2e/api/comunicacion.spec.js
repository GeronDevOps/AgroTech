// CU-05 chat, CU-06 calificación, CU-07 panel de ventas (caja negra)
const { test, expect } = require('@playwright/test');
const {
  auth, uuid, json, crearCuenta, publicar, pedir, entregar, conectarWs, percentil,
} = require('../soporte/api');

const esperarHasta = async (condicion, ms = 5000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (condicion()) return; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error('Tiempo agotado esperando la condición');
};

async function escenario(request, { stock = 20 } = {}) {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(request, { municipio: 'Cúcuta', nombres: 'Andres' });
  const papa = await publicar(request, rosa.token, { precio: 85000, stock });
  const [pedido] = (await json(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }]))).pedidos;
  return { rosa, andres, papa, pedido };
}

test.describe('CU-05 · Chat por pedido', () => {
  test('CP-09: el mensaje llega en tiempo real con su hora', { tag: '@CP-09' }, async ({ request }) => {
    const { rosa, andres, pedido } = await escenario(request);
    const ws = await conectarWs(rosa.token);
    const latencias = [];
    try {
      for (let i = 0; i < 10; i += 1) {
        const id = uuid();
        const enviado = Date.now();
        const r = await request.post(`pedidos/${pedido.id}/mensajes`, { headers: auth(andres.token), data: { id, contenido: `¿Llega hoy? (${i + 1})` } });
        expect(r.status()).toBe(201);
        await esperarHasta(() => ws.recibidos.some((m) => m.tipo === 'mensaje' && m.mensaje.id === id));
        const llegada = ws.recibidos.find((m) => m.tipo === 'mensaje' && m.mensaje.id === id);
        expect(llegada.mensaje).toMatchObject({ idPedido: pedido.id, idEmisor: andres.usuario.id, contenido: `¿Llega hoy? (${i + 1})` });
        expect(Number.isNaN(Date.parse(llegada.mensaje.fecha))).toBe(false);
        latencias.push(llegada.recibidoEn - enviado);
      }
    } finally { ws.close(); }

    // Ambas partes ven el mismo historial, en orden.
    const deAndres = await json(await request.get(`pedidos/${pedido.id}/mensajes`, { headers: auth(andres.token) }));
    const deRosa = await json(await request.get(`pedidos/${pedido.id}/mensajes`, { headers: auth(rosa.token) }));
    expect(deRosa.mensajes.map((m) => m.id)).toEqual(deAndres.mensajes.map((m) => m.id));
    expect(deAndres.mensajes).toHaveLength(10);

    const p95 = percentil(latencias, 95);
    test.info().annotations.push({ type: 'medición', description: `Entrega por WebSocket: p50 ${percentil(latencias, 50)} ms · p95 ${p95} ms (10 mensajes)` });
    expect(p95).toBeLessThan(2000);
  });

  test('CU-05: un tercero no lee el chat y con el pedido entregado queda en solo lectura', { tag: '@CP-09' }, async ({ request }) => {
    const { rosa, andres, pedido } = await escenario(request);
    const intruso = await crearCuenta(request);
    expect((await request.get(`pedidos/${pedido.id}/mensajes`, { headers: auth(intruso.token) })).status()).toBe(404);
    await entregar(request, rosa.token, pedido);
    const r = await request.post(`pedidos/${pedido.id}/mensajes`, { headers: auth(andres.token), data: { id: uuid(), contenido: 'Gracias' } });
    expect(r.status()).toBe(409);
    expect((await json(await request.get(`pedidos/${pedido.id}/mensajes`, { headers: auth(andres.token) }))).abierto).toBe(false);
  });
});

test.describe('CU-06 · Calificar al productor', () => {
  test('CP-10: calificar dos veces el mismo pedido entregado guarda solo la primera', { tag: '@CP-10' }, async ({ request }) => {
    const { rosa, andres, papa, pedido } = await escenario(request);
    const calificar = (cuerpo) => request.post(`pedidos/${pedido.id}/calificacion`, { headers: auth(andres.token), data: cuerpo });

    // Antes de entregar no se puede.
    const temprano = await calificar({ puntuacion: 5 });
    expect(temprano.status()).toBe(409);
    expect((await json(temprano)).error.codigo).toBe('PEDIDO_NO_ENTREGADO');

    await entregar(request, rosa.token, pedido);
    const primera = await calificar({ puntuacion: 4, comentario: 'Buena papa' });
    expect(primera.status()).toBe(201);
    expect((await json(primera)).reputacion).toEqual({ promedio: 4, total: 1 });

    const segunda = await calificar({ puntuacion: 1, comentario: 'Cambio de opinión' });
    expect(segunda.status()).toBe(409);
    expect((await json(segunda)).error).toMatchObject({ codigo: 'YA_CALIFICADO', detalles: { calificacion: { puntuacion: 4 } } });

    // Lo publicado: solo la primera.
    const perfil = await json(await request.get(`productores/${rosa.usuario.id}/calificaciones`, { headers: auth(andres.token) }));
    expect(perfil.reputacion).toEqual({ promedio: 4, total: 1 });
    expect(perfil.calificaciones.map((c) => c.puntuacion)).toEqual([4]);
    const prod = (await json(await request.get(`productos/${papa.id}`, { headers: auth(andres.token) }))).producto;
    expect(prod.productor.calificacion).toEqual({ promedio: 4, total: 1 });
  });
});

test.describe('CU-07 · Panel de ventas', () => {
  test('CP-11: las cifras del mes son iguales a la suma de los pedidos entregados', { tag: '@CP-11' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const [andres, maria] = await Promise.all([crearCuenta(request), crearCuenta(request)]);
    const papa = await publicar(request, rosa.token, { precio: 85000, stock: 50 });
    const mora = await publicar(request, rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 50 }, 'platano');
    const crear = async (cuenta, items) => (await json(await pedir(request, cuenta.token, items))).pedidos[0];

    const entregados = [
      await crear(andres, [{ idProducto: papa.id, cantidad: 2 }]), // 170.000
      await crear(maria, [{ idProducto: papa.id, cantidad: 1 }, { idProducto: mora.id, cantidad: 3 }]), // 98.500
      await crear(andres, [{ idProducto: mora.id, cantidad: 2 }]), // 9.000
    ];
    const enCurso = await crear(maria, [{ idProducto: papa.id, cantidad: 1 }]); // 85.000, no cuenta como venta
    for (const p of entregados) await entregar(request, rosa.token, p);

    const r = await request.get('ventas?periodo=mes', { headers: auth(rosa.token) });
    expect(r.status()).toBe(200);
    const panel = await json(r);
    const ingresos = entregados.reduce((s, p) => s + p.total, 0);
    expect(ingresos).toBe(277500);
    expect(panel.resumen).toEqual({ pedidosEntregados: 3, ingresos, ticketPromedio: Math.round(ingresos / 3) });
    expect(panel.serie.reduce((s, d) => s + d.ingresos, 0)).toBe(ingresos);
    expect(panel.serie.reduce((s, d) => s + d.pedidos, 0)).toBe(3);
    expect(panel.enCurso).toEqual({ pedidos: 1, valor: enCurso.total });
    const top = Object.fromEntries(panel.topProductos.map((t) => [t.nombre, [t.cantidad, t.ingresos]]));
    expect(top).toEqual({ 'Papa pastusa': [3, 255000], Mora: [5, 22500] });

    // El consumidor no tiene panel.
    expect((await request.get('ventas', { headers: auth(andres.token) })).status()).toBe(403);
  });
});
