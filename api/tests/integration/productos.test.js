'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const request = require('supertest');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');

const app = createApp({ pool });

/** JPEG mínimo válido para la validación (cabecera FF D8 FF) con el tamaño pedido. */
const jpeg = (bytes = 2048) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes - 4, 1)]);

async function crearCuenta(nombre, rol, telefono, municipio = 'Pamplonita') {
  const res = await request(app).post('/api/v1/auth/registro').send({
    nombres: nombre, apellidos: 'Prueba', correo: `${nombre.toLowerCase()}@correo.co`, telefono,
    contrasena: 'cosecha2026', rol, municipio, aceptaTratamientoDatos: true,
  });
  return { token: res.body.token, id: res.body.usuario.id };
}

const papa = (extra = {}) => ({
  id: crypto.randomUUID(), nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto',
  precio: 85000, stock: 20, municipio: 'Pamplonita', descripcion: 'Cosecha de esta semana', ...extra,
});

function publicar(token, datos, { foto = jpeg(), miniatura = jpeg(512) } = {}) {
  const r = request(app).post('/api/v1/productos').set('Authorization', `Bearer ${token}`).field('datos', JSON.stringify(datos));
  if (foto) r.attach('foto', foto, { filename: 'foto.jpg', contentType: 'image/jpeg' });
  if (miniatura) r.attach('miniatura', miniatura, { filename: 'min.jpg', contentType: 'image/jpeg' });
  return r;
}

const get = (token, ruta) => request(app).get(`/api/v1${ruta}`).set('Authorization', `Bearer ${token}`);
const patch = (token, id, cuerpo) => request(app).patch(`/api/v1/productos/${id}`).set('Authorization', `Bearer ${token}`).send(cuerpo);

let rosa;
let luis;
let andres;

beforeAll(async () => {
  await migrate({ log: () => {} });
});

beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await crearCuenta('Rosa', 'PRODUCTOR', '3105551234');
  luis = await crearCuenta('Luis', 'PRODUCTOR', '3105559999', 'Ocaña');
  andres = await crearCuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('POST /api/v1/productos (CU-02)', () => {
  test('CP-03 / CA-03: publica con foto, queda ACTIVA y aparece en el catálogo y en "Mis productos"', async () => {
    const datos = papa();
    const res = await publicar(rosa.token, datos);
    expect(res.status).toBe(201);
    expect(res.body.producto).toMatchObject({
      id: datos.id, estado: 'ACTIVA', precio: 85000, stock: 20, unidad: 'bulto', version: 1,
      productor: { id: rosa.id, nombre: 'Rosa P.', calificacion: { promedio: null, total: 0 } },
    });

    // La foto y la miniatura quedan servidas por la API
    const ruta = new URL(res.body.producto.fotoUrl).pathname;
    const foto = await request(app).get(ruta);
    expect(foto.status).toBe(200);
    expect(foto.headers['content-type']).toBe('image/jpeg');
    expect((await request(app).get(new URL(res.body.producto.miniaturaUrl).pathname)).status).toBe(200);

    const catalogo = await get(andres.token, '/productos');
    expect(catalogo.body.productos.map((p) => p.id)).toEqual([datos.id]);
    const mios = await get(rosa.token, '/productos/mios');
    expect(mios.body.productos).toHaveLength(1);
  });

  test('es idempotente por id: el reintento devuelve 200 y no duplica (cola sin conexión)', async () => {
    const datos = papa();
    expect((await publicar(rosa.token, datos)).status).toBe(201);
    const reintento = await publicar(rosa.token, datos);
    expect(reintento.status).toBe(200);
    expect(reintento.body.producto.id).toBe(datos.id);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM producto');
    expect(rows[0].n).toBe(1);
  });

  test('el id de otro productor → 409 ID_EN_USO', async () => {
    const datos = papa();
    await publicar(rosa.token, datos);
    const res = await publicar(luis.token, datos);
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe('ID_EN_USO');
  });

  test('un consumidor no puede publicar → 403', async () => {
    expect((await publicar(andres.token, papa())).status).toBe(403);
  });

  test('A2: sin foto, con archivo que no es JPEG o con datos inválidos no publica', async () => {
    const sinFoto = await publicar(rosa.token, papa(), { foto: null });
    expect(sinFoto.status).toBe(400);
    expect(sinFoto.body.error.detalles.campos).toHaveProperty('foto');

    const png = await publicar(rosa.token, papa(), { foto: Buffer.from('\x89PNG\r\n\x1a\n0000') });
    expect(png.body.error.detalles.campos).toHaveProperty('foto');

    const malos = await publicar(rosa.token, papa({ precio: 85000.5, stock: 0, categoria: 'FLORES' }));
    expect(Object.keys(malos.body.error.detalles.campos).sort()).toEqual(['categoria', 'precio', 'stock']);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM producto');
    expect(rows[0].n).toBe(0);
  });

  test('RNF-09: una foto de más de 300 KB → 413 FOTO_MUY_GRANDE', async () => {
    const res = await publicar(rosa.token, papa(), { foto: jpeg(301 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error.codigo).toBe('FOTO_MUY_GRANDE');
  });
});

describe('GET /api/v1/productos (CU-03)', () => {
  beforeEach(async () => {
    await publicar(rosa.token, papa({ nombre: 'Papa pastusa', precio: 85000 }));
    await publicar(rosa.token, papa({ nombre: 'Mora de castilla', categoria: 'FRUTAS', unidad: 'kg', precio: 4500 }));
    await publicar(luis.token, papa({ nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, municipio: 'Ocaña' }));
  });

  test('CP-05 / CA-05: filtra por municipio, categoría y rango de precio', async () => {
    const nombres = async (q) => (await get(andres.token, `/productos?${q}`)).body.productos.map((p) => p.nombre).sort();
    expect(await nombres('municipio=pamplonita')).toEqual(['Mora de castilla', 'Papa pastusa']);
    expect(await nombres('municipio=Ocaña')).toEqual(['Cebolla junca']);
    expect(await nombres('categoria=FRUTAS')).toEqual(['Mora de castilla']);
    expect(await nombres('precioMin=5000&precioMax=40000')).toEqual(['Cebolla junca']);
    expect(await nombres('municipio=Pamplonita&categoria=HORTALIZAS')).toEqual([]);
  });

  test('pagina por tamano e indica si hay más', async () => {
    const p1 = await get(andres.token, '/productos?tamano=2');
    expect(p1.body).toMatchObject({ pagina: 1, tamano: 2, total: 3, hayMas: true });
    expect(p1.body.productos).toHaveLength(2);
    const p2 = await get(andres.token, '/productos?tamano=2&pagina=2');
    expect(p2.body).toMatchObject({ total: 3, hayMas: false });
    expect(p2.body.productos).toHaveLength(1);
    const p9 = await get(andres.token, '/productos?tamano=2&pagina=9');
    expect(p9.body).toMatchObject({ total: 3, hayMas: false, productos: [] });
  });

  test('filtros inválidos → 400 y sin token → 401', async () => {
    expect((await get(andres.token, '/productos?municipio=Bogotá')).status).toBe(400);
    expect((await get(andres.token, '/productos?precioMin=9&precioMax=1')).status).toBe(400);
    expect((await request(app).get('/api/v1/productos')).status).toBe(401);
  });

  test('no muestra productos de cuentas suspendidas', async () => {
    await pool.query("UPDATE usuario SET estado = 'SUSPENDIDA' WHERE id_usuario = $1", [luis.id]);
    const res = await get(andres.token, '/productos');
    expect(res.body.productos.map((p) => p.nombre)).not.toContain('Cebolla junca');
  });

  test('RNF-09: la página de 20 productos pesa pocos KB (las fotos van aparte como miniaturas)', async () => {
    const res = await get(andres.token, '/productos?tamano=20');
    expect(Buffer.byteLength(res.text)).toBeLessThan(20 * 1024);
  });
});

describe('PATCH /api/v1/productos/{id} (CU-10 · RF-10a)', () => {
  let producto;
  beforeEach(async () => {
    producto = (await publicar(rosa.token, papa())).body.producto;
  });

  test('CP-13 / CA-13: cambia precio y cantidad; con 0 pasa a AGOTADA y sale del catálogo', async () => {
    const r1 = await patch(rosa.token, producto.id, { precio: 90000, stock: 15, version: 1 });
    expect(r1.status).toBe(200);
    expect(r1.body.producto).toMatchObject({ precio: 90000, stock: 15, version: 2, estado: 'ACTIVA' });
    expect((await get(andres.token, '/productos')).body.productos[0]).toMatchObject({ precio: 90000, stock: 15 });

    const r2 = await patch(rosa.token, producto.id, { stock: 0, version: 2 });
    expect(r2.body.producto).toMatchObject({ estado: 'AGOTADA', stock: 0, precio: 90000 });
    expect((await get(andres.token, '/productos')).body.productos).toEqual([]);
    expect((await get(andres.token, `/productos/${producto.id}`)).body.producto.estado).toBe('AGOTADA'); // A3

    const r3 = await patch(rosa.token, producto.id, { stock: 4, version: 3 });
    expect(r3.body.producto.estado).toBe('ACTIVA');
  });

  test('CP-17: versión desactualizada → 409 CONFLICTO_VERSION con los datos vigentes', async () => {
    await patch(rosa.token, producto.id, { precio: 90000, version: 1 });
    const res = await patch(rosa.token, producto.id, { precio: 70000, version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe('CONFLICTO_VERSION');
    expect(res.body.error.detalles.producto).toMatchObject({ precio: 90000, version: 2 });
  });

  test('otro productor no puede editarla (404) y un consumidor tampoco (403)', async () => {
    expect((await patch(luis.token, producto.id, { precio: 1000, version: 1 })).status).toBe(404);
    expect((await patch(andres.token, producto.id, { precio: 1000, version: 1 })).status).toBe(403);
  });

  test('sin cambios o sin versión → 400', async () => {
    const res = await patch(rosa.token, producto.id, { version: 1 });
    expect(res.status).toBe(400);
    expect((await patch(rosa.token, producto.id, { precio: 1000 })).status).toBe(400);
  });
});
