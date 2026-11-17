// Banco de pruebas · Reportes, administración y requisitos no funcionales (BP-076 … BP-088)
const { bp, expect, medir } = require('./soporte');
const {
  auth, json, crearCuenta, publicar, pedir, entrarAdmin, primerPedido, esperarHasta, percentil,
} = require('./comun');

const err = async (r) => (await json(r)).error;
const reportar = (request, token, idContenido, datos) => request.post('reportes', { headers: auth(token), data: { tipoContenido: 'PRODUCTO', idContenido, ...datos } });
const avisos = async (request, token) => (await json(await request.get('notificaciones', { headers: auth(token) }))).notificaciones;

bp('BP-076', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  const r = await reportar(request, andres.token, papa.id, { motivo: 'PRECIO_ABUSIVO', descripcion: 'Doble del precio de la plaza' });
  expect(r.status()).toBe(201);
  expect((await json(r)).reporte.estado).toBe('PENDIENTE');
  const otra = await reportar(request, andres.token, papa.id, { motivo: 'FRAUDE' });
  expect(otra.status()).toBe(409);
  expect((await err(otra)).codigo).toBe('REPORTE_EN_TRAMITE');
});

bp('BP-077', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  const corta = await reportar(request, andres.token, papa.id, { motivo: 'OTRO', descripcion: '123456789' });
  expect(corta.status()).toBe(400);
  expect((await err(corta)).detalles.campos).toHaveProperty('descripcion');
  expect((await reportar(request, andres.token, papa.id, { motivo: 'OTRO', descripcion: '1234567890' })).status()).toBe(201);
});

bp('BP-078', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const papa = await publicar(request, rosa.token);
  const r = await reportar(request, rosa.token, papa.id, { motivo: 'FRAUDE' });
  expect(r.status()).toBe(409);
  expect((await err(r)).codigo).toBe('REPORTE_PROPIO');
});

bp('BP-079', async ({ request }) => {
  const admin = await entrarAdmin(request);
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  for (const t of [rosa.token, andres.token]) {
    for (const ruta of ['admin/resumen', 'admin/usuarios']) expect((await request.get(ruta, { headers: auth(t) })).status()).toBe(403);
  }
  const registros = (await json(await request.get('admin/bitacora?limite=30', { headers: auth(admin.token) }))).registros;
  expect(registros.filter((b) => b.accion === 'ACCESO_DENEGADO').length).toBeGreaterThanOrEqual(4);
});

bp('BP-080', async ({ request }) => {
  const admin = await entrarAdmin(request);
  const ha = { headers: auth(admin.token) };
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  const { reporte } = await json(await reportar(request, andres.token, papa.id, { motivo: 'PUBLICACION_ENGANOSA', descripcion: 'La foto no es del producto' }));
  expect((await json(await request.get(`admin/reportes/${reporte.id}`, ha))).reporte.estado).toBe('EN_REVISION');
  const res = await json(await request.post(`admin/reportes/${reporte.id}/resolver`, { ...ha, data: { decision: 'OCULTAR', resolucion: 'La foto no corresponde al producto.' } }));
  expect(res.reporte).toMatchObject({ estado: 'RESUELTO', decision: 'OCULTAR' });
  expect((await request.get(`productos/${papa.id}`, { headers: auth(andres.token) })).status()).toBe(404);
  await esperarHasta(async () => (await avisos(request, andres.token)).some((n) => n.tipo === 'REPORTE_RESUELTO'));
});

bp('BP-081', async ({ request }) => {
  const admin = await entrarAdmin(request);
  const ha = { headers: auth(admin.token) };
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const motivo = 'Publicaciones engañosas repetidas';
  const sin = await request.post(`admin/usuarios/${rosa.usuario.id}/suspender`, { ...ha, data: { motivo } });
  expect(sin.status()).toBe(409);
  expect(await err(sin)).toMatchObject({ codigo: 'REQUIERE_CONFIRMACION', detalles: { pedidosEnCurso: 1 } });
  const con = await json(await request.post(`admin/usuarios/${rosa.usuario.id}/suspender`, { ...ha, data: { motivo, confirmar: true } }));
  expect(con).toMatchObject({ usuario: { estado: 'SUSPENDIDA' }, pedidosCancelados: 1 });
  expect((await request.get('auth/yo', { headers: auth(rosa.token) })).status()).toBe(401);
  expect((await json(await request.post(`admin/usuarios/${rosa.usuario.id}/reactivar`, ha))).usuario.estado).toBe('ACTIVA');
});

bp('BP-082', async ({ request }) => {
  const admin = await entrarAdmin(request);
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  const antes = (await json(await request.get(`productos/${papa.id}`, { headers: auth(andres.token) }))).producto.productor.verificado;
  expect(antes).toBe(false);
  const r = await json(await request.post(`admin/usuarios/${rosa.usuario.id}/verificar`, { headers: auth(admin.token), data: { verificado: true } }));
  expect(r.usuario.verificado).toBe(true);
  expect((await json(await request.get(`productos/${papa.id}`, { headers: auth(andres.token) }))).producto.productor.verificado).toBe(true);
});

bp('BP-083', async ({ request }) => {
  const admin = await entrarAdmin(request);
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  const { reporte } = await json(await reportar(request, andres.token, papa.id, { motivo: 'FRAUDE', descripcion: 'No me gusta este productor' }));
  const res = await json(await request.post(`admin/reportes/${reporte.id}/resolver`, { headers: auth(admin.token), data: { decision: 'DESESTIMAR', resolucion: 'El reporte no tiene fundamento.', malintencionado: true } }));
  expect(res.reporte).toMatchObject({ estado: 'DESESTIMADO' });
  await esperarHasta(async () => (await avisos(request, andres.token)).some((n) => n.tipo === 'ADVERTENCIA'));
  expect((await request.get(`productos/${papa.id}`, { headers: auth(andres.token) })).status()).toBe(200);
});

bp('BP-084', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  for (let i = 0; i < 5; i += 1) await publicar(request, rosa.token, { nombre: `Papa muestra ${i}` });
  const consultas = [
    'productos', 'productos?categoria=TUBERCULOS', 'productos?municipio=Pamplona', 'productos?q=papa',
    'productos?orden=precio_asc', 'productos?lat=7.3781&lon=-72.6486&radioKm=25',
  ];
  const tiempos = [];
  for (let i = 0; i < 30; i += 1) {
    const t0 = performance.now();
    const r = await request.get(consultas[i % consultas.length], { headers: auth(andres.token) });
    tiempos.push(performance.now() - t0);
    expect(r.status()).toBe(200);
  }
  const p95 = percentil(tiempos, 95);
  medir(`p95 = ${p95.toFixed(0)} ms · media = ${(tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(0)} ms (30 consultas)`);
  expect(p95).toBeLessThanOrEqual(3000);
});

bp('BP-085', async ({ request }) => {
  const r = await request.get('salud');
  const h = r.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h).not.toHaveProperty('x-powered-by');
});

bp('BP-086', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  await publicar(request, rosa.token);
  const h = { headers: auth(andres.token) };
  const q = await request.get(`productos?q=${encodeURIComponent("' OR 1=1 --")}`, h);
  expect(q.status()).toBe(200);
  expect((await json(q)).total).toBe(0);
  const m = await request.get(`productos?municipio=${encodeURIComponent("Pamplona' --")}`, h);
  expect(m.status()).toBe(400);
  const id = await request.get(`productos/${encodeURIComponent('1 OR 1=1')}`, h);
  expect(id.status()).toBe(404);
});

bp('BP-087', async ({ request }) => {
  const r = await request.post('auth/registro', { data: { relleno: 'x'.repeat(2 * 1024 * 1024) } });
  expect(r.status()).toBe(413);
  expect((await err(r)).codigo).toBe('DEMASIADO_GRANDE');
});

bp('BP-088', async ({ request }) => {
  const r = await request.get('salud');
  expect(r.status()).toBe(200);
  const b = await json(r);
  medir(`Respuesta de /salud: ${JSON.stringify(b)}`);
});
