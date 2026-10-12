'use strict';

const crypto = require('node:crypto');
const request = require('supertest');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const { createAlmacenFotosS3 } = require('../../src/almacenamiento/fotos-s3');
const { crearAyudas, jpeg } = require('./ayudas');

/** Bucket en memoria con el mismo contrato que S3 (send(comando)). Puede fallar a pedido. */
function bucketEnMemoria() {
  const objetos = new Map();
  const b = {
    objetos,
    fallarEn: null, // número de PutObject que debe fallar (1 = el primero)
    puts: 0,
    async send(cmd) {
      const nombre = cmd.constructor.name;
      if (nombre === 'PutObjectCommand') {
        b.puts += 1;
        if (b.fallarEn === b.puts) throw Object.assign(new Error('Service Unavailable'), { name: 'ServiceUnavailable' });
        objetos.set(cmd.input.Key, { cuerpo: cmd.input.Body, tipo: cmd.input.ContentType });
      } else if (nombre === 'DeleteObjectCommand') {
        objetos.delete(cmd.input.Key);
      }
      return {};
    },
  };
  return b;
}

const bucket = bucketEnMemoria();
const almacenFotos = createAlmacenFotosS3({ bucket: 'agrotech-imagenes', region: 'us-east-1', cliente: bucket });
const app = createApp({ pool, almacenFotos });
const { cuenta, producto, get } = crearAyudas(app);

let rosa; let andres;

beforeAll(async () => { await migrate({ log: () => {} }); });

beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  bucket.objetos.clear();
  bucket.puts = 0;
  bucket.fallarEn = null;
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
});

afterAll(async () => { await pool.end(); });

const publicar = (datos) => request(app).post('/api/v1/productos').set('Authorization', `Bearer ${rosa.token}`)
  .field('datos', JSON.stringify({ id: crypto.randomUUID(), nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20, municipio: 'Pamplonita', ...datos }))
  .attach('foto', jpeg(), { filename: 'f.jpg', contentType: 'image/jpeg' })
  .attach('miniatura', jpeg(512), { filename: 'm.jpg', contentType: 'image/jpeg' });

describe('Fotos en Amazon S3 (AGRO-16 · FOTOS_DRIVER=s3)', () => {
  test('CU-02: la foto y la miniatura van al bucket y el catálogo entrega URLs del bucket', async () => {
    const p = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
    const clave = `productos/${rosa.id}/${p.id}.jpg`;
    expect([...bucket.objetos.keys()].sort()).toEqual([clave, clave.replace('.jpg', '_min.jpg')].sort());
    expect(bucket.objetos.get(clave).tipo).toBe('image/jpeg');
    const base = 'https://agrotech-imagenes.s3.us-east-1.amazonaws.com';
    expect(p).toMatchObject({ fotoUrl: `${base}/${clave}`, miniaturaUrl: `${base}/${clave.replace('.jpg', '_min.jpg')}` });
    const catalogo = await get(andres.token, '/productos');
    expect(catalogo.body.productos[0].miniaturaUrl).toBe(`${base}/${clave.replace('.jpg', '_min.jpg')}`);
    const pull = await get(andres.token, '/sync/pull');
    expect(pull.body.productos[0].fotoUrl).toBe(`${base}/${clave}`);
  });

  test('con S3 la API no sirve /fotos (la app descarga directo del bucket)', async () => {
    const p = await producto(rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 5 });
    expect((await request(app).get(`/fotos/productos/${rosa.id}/${p.id}.jpg`)).status).toBe(404);
  });

  test('si S3 falla al subir la miniatura: 503, sin fotos huérfanas ni publicación; el reintento funciona', async () => {
    const id = crypto.randomUUID();
    bucket.fallarEn = 2;
    const r = await publicar({ id });
    expect(r.status).toBe(503);
    expect(r.body.error.codigo).toBe('NO_DISPONIBLE');
    expect(bucket.objetos.size).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM producto')).rows[0].n).toBe(0);

    bucket.fallarEn = null; // la cola de la app reintenta con el mismo id
    const otra = await publicar({ id });
    expect(otra.status).toBe(201);
    expect(bucket.objetos.size).toBe(2);
  });
});
