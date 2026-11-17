// Banco de pruebas · Inventario y catálogo (BP-024 … BP-046)
const { bp, expect } = require('./soporte');
const {
  auth, json, uuid, crearCuenta, publicar, pedir, foto, marca, primerPedido,
} = require('./comun');

const err = async (r) => (await json(r)).error;
/** Publicación cruda (sin esperar 201) para los casos de límites. */
const publicarCrudo = (request, token, datos, conFoto = true) => request.post('productos', {
  headers: auth(token),
  multipart: {
    datos: JSON.stringify({ id: uuid(), nombre: `Papa ${marca()}`, categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20, municipio: 'Pamplona', ...datos }),
    ...(conFoto ? { foto: foto('papa'), miniatura: foto('papa_min') } : {}),
  },
});
const catalogo = async (request, token, q) => request.get(`productos?${new URLSearchParams(q)}`, { headers: auth(token) });

bp('BP-024', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const nombre = `Papa ${marca()}`;
  const r = await publicarCrudo(request, rosa.token, { nombre });
  expect(r.status()).toBe(201);
  const { producto } = await json(r);
  expect(producto).toMatchObject({ estado: 'ACTIVA', nombre, precio: 85000, stock: 20 });
  expect(producto.fotoUrl).toMatch(/\.jpg$/);
  expect(producto.miniaturaUrl).toMatch(/_min\.jpg$/);
  expect((await json(await catalogo(request, andres.token, { q: nombre }))).productos.map((p) => p.id)).toEqual([producto.id]);
});

bp('BP-025', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const r = await publicarCrudo(request, rosa.token, {}, false);
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.campos).toHaveProperty('foto');
});

bp('BP-026', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  expect((await publicarCrudo(request, rosa.token, { precio: 49 })).status()).toBe(400);
  expect((await publicarCrudo(request, rosa.token, { precio: 50 })).status()).toBe(201);
});

bp('BP-027', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  expect((await publicarCrudo(request, rosa.token, { precio: 50_000_000 })).status()).toBe(201);
  const r = await publicarCrudo(request, rosa.token, { precio: 50_000_001 });
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.campos).toHaveProperty('precio');
});

bp('BP-028', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  expect((await publicarCrudo(request, rosa.token, { stock: 0 })).status()).toBe(400);
  expect((await publicarCrudo(request, rosa.token, { stock: 100_001 })).status()).toBe(400);
  expect((await publicarCrudo(request, rosa.token, { stock: 100_000 })).status()).toBe(201);
});

bp('BP-029', async ({ request }) => {
  const andres = await crearCuenta(request);
  const r = await publicarCrudo(request, andres.token, {});
  expect(r.status()).toBe(403);
  expect((await err(r)).codigo).toBe('SIN_PERMISO');
});

bp('BP-030', async ({ request }) => {
  const m = marca();
  const luis = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Pamplona' });
  await publicar(request, luis.token, { nombre: `Cebolla ${m}`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Ocaña' }, 'cebolla');
  await publicar(request, rosa.token, { nombre: `Mora ${m}`, categoria: 'FRUTAS', unidad: 'kg', municipio: 'Pamplona' }, 'platano');
  const andres = await crearCuenta(request);
  const nombres = async (q) => (await json(await catalogo(request, andres.token, { q: m, ...q }))).productos.map((p) => p.nombre);
  expect(await nombres({ municipio: 'Ocaña' })).toEqual([`Cebolla ${m}`]);
  expect(await nombres({ categoria: 'FRUTAS' })).toEqual([`Mora ${m}`]);
  expect(await nombres({ municipio: 'Ocaña', categoria: 'FRUTAS' })).toEqual([]);
});

bp('BP-031', async ({ request }) => {
  const andres = await crearCuenta(request);
  const r = await catalogo(request, andres.token, { precioMin: 5000, precioMax: 1000 });
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.campos).toHaveProperty('precioMax');
});

bp('BP-032', async ({ request }) => {
  const andres = await crearCuenta(request);
  for (const [tamano, estado] of [[0, 400], [1, 200], [50, 200], [51, 400]]) {
    expect((await catalogo(request, andres.token, { tamano })).status(), `tamano ${tamano}`).toBe(estado);
  }
});

bp('BP-033', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const papa = await publicar(request, rosa.token);
  const a = await request.patch(`productos/${papa.id}`, { headers: auth(rosa.token), data: { precio: 90000, version: papa.version } });
  expect(a.status()).toBe(200);
  const b = await request.patch(`productos/${papa.id}`, { headers: auth(rosa.token), data: { precio: 95000, version: papa.version } });
  expect(b.status()).toBe(409);
  expect(await err(b)).toMatchObject({ codigo: 'CONFLICTO_VERSION', detalles: { producto: { precio: 90000 } } });
});

bp('BP-034', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const nombre = `Papa ${marca()}`;
  let p = await publicar(request, rosa.token, { nombre });
  p = (await json(await request.patch(`productos/${p.id}`, { headers: auth(rosa.token), data: { stock: 0, version: p.version } }))).producto;
  expect(p.estado).toBe('AGOTADA');
  expect((await json(await catalogo(request, andres.token, { q: nombre }))).total).toBe(0);
  p = (await json(await request.patch(`productos/${p.id}`, { headers: auth(rosa.token), data: { stock: 5, version: p.version } }))).producto;
  expect(p.estado).toBe('ACTIVA');
});

bp('BP-035', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const nombre = `Papa ${marca()}`;
  let p = await publicar(request, rosa.token, { nombre });
  p = (await json(await request.patch(`productos/${p.id}/estado`, { headers: auth(rosa.token), data: { accion: 'PAUSAR', version: p.version } }))).producto;
  expect(p.estado).toBe('PAUSADA');
  expect((await json(await catalogo(request, andres.token, { q: nombre }))).total).toBe(0);
  expect((await request.get(`productos/${p.id}`, { headers: auth(andres.token) })).status()).toBe(404);
  p = (await json(await request.patch(`productos/${p.id}/estado`, { headers: auth(rosa.token), data: { accion: 'REACTIVAR', version: p.version } }))).producto;
  expect(p.estado).toBe('ACTIVA');
});

bp('BP-036', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(request);
  const p = await publicar(request, rosa.token);
  await primerPedido(await pedir(request, andres.token, [{ idProducto: p.id, cantidad: 1 }]));
  const vigente = (await json(await request.get(`productos/${p.id}`, { headers: auth(rosa.token) }))).producto;
  const r = await request.patch(`productos/${p.id}/estado`, { headers: auth(rosa.token), data: { accion: 'RETIRAR', version: vigente.version } });
  expect(r.status()).toBe(409);
  expect(await err(r)).toMatchObject({ codigo: 'PEDIDOS_EN_CURSO', detalles: { pedidos: 1 } });
});

bp('BP-037', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const p = await publicar(request, rosa.token);
  const a = await request.patch(`productos/${p.id}/estado`, { headers: auth(rosa.token), data: { accion: 'REACTIVAR', version: p.version } });
  expect((await err(a)).codigo).toBe('ESTADO_NO_PERMITIDO');
  const b = await request.patch(`productos/${p.id}/estado`, { headers: auth(rosa.token), data: { accion: 'BORRAR', version: p.version } });
  expect(b.status()).toBe(400);
  expect((await err(b)).detalles.campos).toHaveProperty('accion');
});

bp('BP-038', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const luis = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const p = await publicar(request, rosa.token);
  expect((await request.patch(`productos/${p.id}`, { headers: auth(luis.token), data: { precio: 1000, version: p.version } })).status()).toBe(404);
  expect((await request.patch(`productos/${p.id}/estado`, { headers: auth(luis.token), data: { accion: 'PAUSAR', version: p.version } })).status()).toBe(404);
  expect((await json(await request.get(`productos/${p.id}`, { headers: auth(rosa.token) }))).producto).toMatchObject({ precio: 85000, estado: 'ACTIVA' });
});

bp('BP-039', async ({ request }) => {
  const m = marca();
  const luis = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
  await publicar(request, luis.token, { nombre: `Café ${m} pergamino`, categoria: 'CAFE_CACAO', unidad: 'kg', municipio: 'Ocaña' });
  await publicar(request, luis.token, { nombre: `Panela ${m}`, descripcion: `Ideal con el CAFÉ ${m}`, categoria: 'OTROS', unidad: 'kg', municipio: 'Ocaña' }, 'cebolla');
  const andres = await crearCuenta(request);
  const r = await json(await catalogo(request, andres.token, { q: `cafe ${m}` }));
  expect(r.productos.map((p) => p.nombre).sort()).toEqual([`Café ${m} pergamino`, `Panela ${m}`]);
});

bp('BP-040', async ({ request }) => {
  const andres = await crearCuenta(request);
  const corta = await catalogo(request, andres.token, { q: 'pa' });
  expect(corta.status()).toBe(400);
  expect((await err(corta)).detalles.campos).toHaveProperty('q');
  expect((await catalogo(request, andres.token, { q: 'pap' })).status()).toBe(200);
  const total = (await json(await catalogo(request, andres.token, {}))).total;
  // Los comodines de LIKE se descartan: «%_%zzq» busca «zzq», no todo el catálogo.
  const comodin = await catalogo(request, andres.token, { q: '%_%zzq' });
  expect(comodin.status()).toBe(200);
  expect((await json(comodin)).total).toBeLessThan(Math.max(total, 1));
});

bp('BP-041', async ({ request }) => {
  const m = marca();
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  for (const precio of [3000, 9000, 6000]) await publicar(request, rosa.token, { nombre: `Mora ${m} ${precio}`, categoria: 'FRUTAS', unidad: 'kg', precio }, 'platano');
  await publicar(request, rosa.token, { nombre: `Papa ${m}`, precio: 99000 });
  const andres = await crearCuenta(request);
  const r = await json(await catalogo(request, andres.token, { q: m, orden: 'precio_desc', categoria: 'FRUTAS' }));
  expect(r.productos.map((p) => p.precio)).toEqual([9000, 6000, 3000]);
});

bp('BP-042', async ({ request }) => {
  const andres = await crearCuenta(request);
  const r = await catalogo(request, andres.token, { orden: 'alfabetico' });
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.campos).toHaveProperty('orden');
});

bp('BP-043', async ({ request }) => {
  const andres = await crearCuenta(request);
  const r = await json(await catalogo(request, andres.token, { q: `zzz${marca()}` }));
  expect(r.total).toBe(0);
  expect(r.sugerencias.length).toBeGreaterThan(0);
});

bp('BP-044', async ({ request }) => {
  const m = marca();
  const ocana = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
  const pamplona = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Pamplona' });
  await publicar(request, pamplona.token, { nombre: `Tomate ${m} P`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Pamplona' }, 'cebolla');
  await publicar(request, ocana.token, { nombre: `Tomate ${m} O`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Ocaña' }, 'cebolla');
  const andres = await crearCuenta(request);
  const r = await json(await catalogo(request, andres.token, { q: `tomate ${m}`, orden: 'cercania', lat: 8.24, lon: -73.35 }));
  expect(r.ubicacion.origen).toBe('TELEFONO');
  expect(r.productos.map((p) => p.municipio)).toEqual(['Ocaña', 'Pamplona']);
  expect(r.productos[0].distanciaKm).toBeLessThan(r.productos[1].distanciaKm);
});

bp('BP-045', async ({ request }) => {
  const andres = await crearCuenta(request);
  for (const [radioKm, estado] of [[0, 400], [1, 200], [300, 200], [301, 400]]) {
    expect((await catalogo(request, andres.token, { orden: 'cercania', radioKm, lat: 7.37, lon: -72.64 })).status(), `radio ${radioKm}`).toBe(estado);
  }
});

bp('BP-046', async ({ request }) => {
  const andres = await crearCuenta(request);
  const r = await json(await catalogo(request, andres.token, { orden: 'cercania', radioKm: 5, lat: 6.95, lon: -72.1 }));
  expect(r).toMatchObject({ total: 0, ampliarRadio: { radioActualKm: 5, sugeridoKm: 10 } });
});
