// Banco de pruebas · Pedidos, pagos, comunicación, avisos y sincronización (BP-047 … BP-075)
const { bp, expect, medir } = require('./soporte');
const {
  auth, json, uuid, crearCuenta, publicar, pedir, cambiarEstado, entregar, aceptar, eventoWompi, conectarWs, primerPedido, esperarHasta,
} = require('./comun');
const { WOMPI_SECRETO_EVENTOS } = require('../entorno');

const err = async (r) => (await json(r)).error;
async function escenario(request, stock = 20) {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(request, { nombres: 'Andres' });
  const papa = await publicar(request, rosa.token, { stock });
  return { rosa, andres, papa };
}
const stockDe = async (request, token, p) => (await json(await request.get(`productos/${p.id}`, { headers: auth(token) }))).producto.stock;

bp('BP-047', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 3 }]));
  expect(p).toMatchObject({ estado: 'PENDIENTE', total: 255000 });
  expect(await stockDe(request, rosa.token, papa)).toBe(17);
});

bp('BP-048', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request, 5);
  const r = await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 6 }]);
  expect(r.status()).toBe(409);
  expect((await err(r)).codigo).toBe('STOCK_INSUFICIENTE');
  expect(await stockDe(request, rosa.token, papa)).toBe(5);
  await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 5 }]));
  const vigente = (await json(await request.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto;
  expect(vigente).toMatchObject({ stock: 0, estado: 'AGOTADA' });
});

bp('BP-049', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request, 10);
  const clave = uuid();
  const a = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }], { clave }));
  const segunda = await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }], { clave });
  expect(segunda.status()).toBeLessThan(300);
  expect((await json(segunda)).pedidos[0].id).toBe(a.id);
  expect(await stockDe(request, rosa.token, papa)).toBe(8);
});

bp('BP-050', async ({ request }) => {
  const { rosa, papa } = await escenario(request);
  const r = await pedir(request, rosa.token, [{ idProducto: papa.id, cantidad: 1 }]);
  expect(r.status()).toBe(403);
});

bp('BP-051', async ({ request }) => {
  const { andres, papa } = await escenario(request);
  const luis = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
  const cebolla = await publicar(request, luis.token, { nombre: 'Cebolla', categoria: 'HORTALIZAS', unidad: 'kg', precio: 2500, municipio: 'Ocaña' }, 'cebolla');
  const r = await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }, { idProducto: cebolla.id, cantidad: 4 }]);
  expect(r.status()).toBe(201);
  const { pedidos } = await json(r);
  expect(pedidos).toHaveLength(2);
  expect(pedidos.map((p) => p.total).sort((x, y) => x - y)).toEqual([10000, 85000]);
});

bp('BP-052', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const d = (await json(await request.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido;
  expect(d.historial.map((h) => h.estadoNuevo)).toEqual(['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'ENTREGADO']);
  expect(d.historial.every((h) => !Number.isNaN(Date.parse(h.fecha)))).toBe(true);
});

bp('BP-053', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const r = await cambiarEstado(request, rosa.token, p, 'ENTREGADO');
  expect(r.status()).toBe(409);
  expect((await err(r)).codigo).toBe('TRANSICION_NO_PERMITIDA');
  expect((await json(await request.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido.estado).toBe('PENDIENTE');
});

bp('BP-054', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 4 }]));
  const sin = await cambiarEstado(request, rosa.token, p, 'CANCELADO');
  expect(sin.status()).toBe(400);
  expect((await err(sin)).detalles.campos).toHaveProperty('motivo');
  const con = await json(await cambiarEstado(request, rosa.token, p, 'CANCELADO', { motivo: 'No tengo papa esta semana' }));
  expect(con.pedido).toMatchObject({ estado: 'CANCELADO' });
  expect(con.pedido.motivoCancelacion).toContain('No tengo papa');
  expect(await stockDe(request, rosa.token, papa)).toBe(20);
});

bp('BP-055', async ({ request }) => {
  const { andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const r = await cambiarEstado(request, andres.token, p, 'ACEPTADO');
  expect(r.status()).toBe(403);
});

bp('BP-056', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await aceptar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 3 }])));
  const r = await json(await request.post(`pedidos/${p.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Ya no lo necesito' } }));
  expect(r.pedido).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Consumidor: Ya no lo necesito' });
  expect(await stockDe(request, rosa.token, papa)).toBe(20);
  const chat = await request.post(`pedidos/${p.id}/mensajes`, { headers: auth(andres.token), data: { id: uuid(), contenido: 'Hola' } });
  expect((await err(chat)).codigo).toBe('CHAT_CERRADO');
});

bp('BP-057', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 5 }]));
  const [a, b] = await Promise.all([
    request.post(`pedidos/${p.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Me equivoqué' } }),
    request.post(`pedidos/${p.id}/cancelar`, { headers: auth(rosa.token), data: { motivo: 'No tengo el producto' } }),
  ]);
  expect([a.status(), b.status()].sort()).toEqual([200, 409]);
  expect((await err([a, b].find((x) => x.status() === 409))).codigo).toBe('YA_CANCELADO');
  expect(await stockDe(request, rosa.token, papa)).toBe(20);
});

bp('BP-058', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const r = await request.post(`pedidos/${p.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Tarde' } });
  expect((await err(r)).codigo).toBe('PEDIDO_ENTREGADO');
  expect((await json(await request.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido.acciones).toContain('REPORTAR');
});

bp('BP-059', async ({ request }) => {
  const { andres, papa } = await escenario(request);
  const intruso = await crearCuenta(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  expect((await request.get(`pedidos/${p.id}`, { headers: auth(intruso.token) })).status()).toBe(404);
  expect((await request.post(`pedidos/${p.id}/cancelar`, { headers: auth(intruso.token), data: { motivo: 'Porque sí' } })).status()).toBe(404);
});

bp('BP-060', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p1 = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const p2 = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  await request.post(`pedidos/${p2.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Me equivoqué' } });
  const p3 = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const ids = async (q) => (await json(await request.get(`pedidos?${new URLSearchParams(q)}`, { headers: auth(andres.token) }))).pedidos.map((x) => x.id);
  expect(await ids({ estado: 'activos' })).toEqual([p3.id]);
  expect(await ids({ estado: 'finalizados' })).toEqual([p2.id, p1.id]);
  expect(await ids({ estado: 'ENTREGADO' })).toEqual([p1.id]);
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  expect(await ids({ estado: 'todos', desde: hoy, hasta: hoy })).toEqual([p3.id, p2.id, p1.id]);
  expect((await request.get('pedidos?desde=15-11-2026', { headers: auth(andres.token) })).status()).toBe(400);
});

const conPasarela = () => require('@playwright/test').test.skip(!WOMPI_SECRETO_EVENTOS, 'Requiere la pasarela de pruebas (WOMPI) configurada.');

bp('BP-061', async ({ request }) => {
  conPasarela();
  const { andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }], { metodoPago: 'EN_LINEA' }));
  const inicio = await json(await request.post(`pedidos/${p.id}/pago`, { headers: auth(andres.token) }));
  expect(inicio.urlCheckout).toMatch(/^https:\/\/checkout\.wompi\.co/);
  const ev = await request.post('pagos/wompi/eventos', { data: eventoWompi({ status: 'APPROVED', reference: inicio.pago.referencia, amount: inicio.pago.montoCentavos, secreto: WOMPI_SECRETO_EVENTOS }) });
  expect(ev.status()).toBe(200);
  expect((await json(await request.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido.estadoPago).toBe('APROBADO');
});

bp('BP-062', async ({ request }) => {
  conPasarela();
  const { andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }], { metodoPago: 'EN_LINEA' }));
  const inicio = await json(await request.post(`pedidos/${p.id}/pago`, { headers: auth(andres.token) }));
  const ev = await request.post('pagos/wompi/eventos', { data: eventoWompi({ status: 'APPROVED', reference: inicio.pago.referencia, amount: inicio.pago.montoCentavos, secreto: 'secreto-de-un-atacante' }) });
  expect(ev.status()).toBe(401);
  expect((await err(ev)).codigo).toBe('FIRMA_INVALIDA');
  expect((await json(await request.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido.estadoPago).not.toBe('APROBADO');
});

bp('BP-063', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }], { metodoPago: 'EN_LINEA' }));
  const r = await cambiarEstado(request, rosa.token, p, 'ACEPTADO');
  expect(r.status()).toBe(409);
  expect((await err(r)).codigo).toBe('PAGO_NO_APROBADO');
});

bp('BP-064', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const ws = await conectarWs(rosa.token);
  try {
    const t0 = Date.now();
    await request.post(`pedidos/${p.id}/mensajes`, { headers: auth(andres.token), data: { id: uuid(), contenido: '¿Llega hoy?' } });
    await esperarHasta(() => ws.recibidos.some((m) => m.tipo === 'mensaje' && m.mensaje.contenido === '¿Llega hoy?'), 3000);
    const llegada = ws.recibidos.find((m) => m.tipo === 'mensaje');
    medir(`Mensaje recibido por WebSocket en ${llegada.recibidoEn - t0} ms`);
  } finally { ws.close(); }
});

bp('BP-065', async ({ request }) => {
  const { andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const enviar = (contenido) => request.post(`pedidos/${p.id}/mensajes`, { headers: auth(andres.token), data: { id: uuid(), contenido } });
  expect((await enviar('a'.repeat(500))).status()).toBe(201);
  expect((await enviar('a'.repeat(501))).status()).toBe(400);
  expect((await enviar('   ')).status()).toBe(400);
});

bp('BP-066', async ({ request }) => {
  const { andres, papa } = await escenario(request);
  const intruso = await crearCuenta(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  expect((await request.get(`pedidos/${p.id}/mensajes`, { headers: auth(intruso.token) })).status()).toBe(404);
  expect((await request.post(`pedidos/${p.id}/mensajes`, { headers: auth(intruso.token), data: { id: uuid(), contenido: 'Hola' } })).status()).toBe(404);
});

bp('BP-067', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await aceptar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const r = await request.post(`pedidos/${p.id}/calificacion`, { headers: auth(andres.token), data: { puntuacion: 5 } });
  expect(r.status()).toBe(409);
  expect((await err(r)).codigo).toBe('PEDIDO_NO_ENTREGADO');
});

bp('BP-068', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const calificar = (puntuacion) => request.post(`pedidos/${p.id}/calificacion`, { headers: auth(andres.token), data: { puntuacion, comentario: 'Buena papa' } });
  expect((await calificar(0)).status()).toBe(400);
  expect((await calificar(6)).status()).toBe(400);
  expect((await calificar(5)).status()).toBe(201);
  const otra = await calificar(4);
  expect(otra.status()).toBe(409);
  expect((await err(otra)).codigo).toBe('YA_CALIFICADO');
});

bp('BP-069', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const a = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }])));
  const b = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const curso = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const panel = await json(await request.get('ventas?periodo=mes', { headers: auth(rosa.token) }));
  expect(panel.resumen).toMatchObject({ pedidosEntregados: 2, ingresos: a.total + b.total });
  expect(panel.enCurso).toEqual({ pedidos: 1, valor: curso.total });
  expect(panel.topProductos[0]).toMatchObject({ nombre: 'Papa pastusa', cantidad: 3 });
  expect((await request.get('ventas', { headers: auth(andres.token) })).status()).toBe(403);
});

bp('BP-070', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await aceptar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  await cambiarEstado(request, rosa.token, p, 'EN_CAMINO');
  await esperarHasta(async () => (await json(await request.get('notificaciones', { headers: auth(andres.token) }))).sinLeer === 2);
  const b = await json(await request.get('notificaciones', { headers: auth(andres.token) }));
  expect(b.notificaciones.map((n) => n.tipo)).toEqual(['PEDIDO_EN_CAMINO', 'PEDIDO_ACEPTADO']);
  await request.post('notificaciones/leidas', { headers: auth(andres.token) });
  expect((await json(await request.get('notificaciones', { headers: auth(andres.token) }))).sinLeer).toBe(0);
});

bp('BP-071', async ({ request }) => {
  const { rosa, andres, papa } = await escenario(request);
  const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  await request.post(`pedidos/${p.id}/mensajes`, { headers: auth(rosa.token), data: { id: uuid(), contenido: 'Mañana a las 9' } });
  await esperarHasta(async () => (await json(await request.get('notificaciones', { headers: auth(andres.token) }))).notificaciones.some((n) => n.tipo === 'MENSAJE'));
  const aviso = (await json(await request.get('notificaciones', { headers: auth(andres.token) }))).notificaciones.find((n) => n.tipo === 'MENSAJE');
  expect(aviso).toMatchObject({ cuerpo: 'Mañana a las 9', datos: { idPedido: p.id, abrir: 'CHAT' } });
});

bp('BP-072', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const p = await publicar(request, rosa.token);
  const op = { idOperacion: uuid(), tipo: 'PRODUCTO.ESTADO', idEntidad: p.id, datos: { accion: 'PAUSAR', version: p.version } };
  const enviar = async () => (await json(await request.post('sync/push', { headers: auth(rosa.token), data: { operaciones: [op] } }))).resultados[0];
  expect(await enviar()).toMatchObject({ resultado: 'PUBLICADO', producto: { estado: 'PAUSADA' } });
  expect((await enviar()).resultado).toBe('YA_APLICADA');
});

bp('BP-073', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const p = await publicar(request, rosa.token);
  await request.patch(`productos/${p.id}`, { headers: auth(rosa.token), data: { precio: 90000, version: p.version } });
  const op = { idOperacion: uuid(), tipo: 'PRODUCTO.EDITAR', idEntidad: p.id, datos: { precio: 70000, version: p.version } };
  const r = (await json(await request.post('sync/push', { headers: auth(rosa.token), data: { operaciones: [op] } }))).resultados[0];
  expect(r).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'CONFLICTO_VERSION' } });
});

bp('BP-074', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const primera = await json(await request.get('sync/pull', { headers: auth(andres.token) }));
  const p = await publicar(request, rosa.token, { nombre: 'Papa criolla' });
  const nueva = await json(await request.get(`sync/pull?desde=${encodeURIComponent(primera.servidorEn)}`, { headers: auth(andres.token) }));
  expect(nueva.productos.map((x) => x.id)).toContain(p.id);
});

bp('BP-075', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const productos = [];
  for (let i = 0; i < 25; i += 1) productos.push(await publicar(request, rosa.token, { nombre: `Papa lote ${i}` }));
  // Por cada publicación: pausar (versión leída) y reactivar (versión + 1), en orden cronológico como la cola del teléfono.
  const operaciones = productos.flatMap((p) => [
    { idOperacion: uuid(), tipo: 'PRODUCTO.ESTADO', idEntidad: p.id, datos: { accion: 'PAUSAR', version: p.version } },
    { idOperacion: uuid(), tipo: 'PRODUCTO.ESTADO', idEntidad: p.id, datos: { accion: 'REACTIVAR', version: p.version + 1 } },
  ]);
  const t0 = Date.now();
  const { resultados } = await json(await request.post('sync/push', { headers: auth(rosa.token), data: { operaciones } }));
  const ok = resultados.filter((r) => r.resultado === 'PUBLICADO').length;
  medir(`${ok}/${operaciones.length} operaciones sincronizadas (${((ok / operaciones.length) * 100).toFixed(0)} %) en ${Date.now() - t0} ms`);
  expect(ok / operaciones.length).toBeGreaterThanOrEqual(0.98);
});
