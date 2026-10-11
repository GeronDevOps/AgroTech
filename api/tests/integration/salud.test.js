'use strict';

const request = require('supertest');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');

const app = createApp({ pool });

beforeAll(async () => {
  await migrate({ log: () => {} });
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/v1/salud', () => {
  test('responde 200 con la base de datos migrada', async () => {
    const res = await request(app).get('/api/v1/salud');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
    expect(res.body.baseDeDatos.estado).toBe('ok');
    expect(res.body.baseDeDatos.migracion).toBe('001');
  });

  test('incluye cabeceras de seguridad y oculta X-Powered-By', async () => {
    const res = await request(app).get('/api/v1/salud');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Errores con formato único', () => {
  test('una ruta inexistente responde 404 con { error: { codigo, mensaje } }', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  test('un JSON mal formado responde 400', async () => {
    const res = await request(app).post('/api/v1/salud').set('Content-Type', 'application/json').send('{"mal":');
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('DATOS_INVALIDOS');
  });
});

describe('Restricciones de la migración 001', () => {
  test('la base de datos rechaza un salto de estado del pedido (PENDIENTE → ENTREGADO)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const u = await client.query(`
        INSERT INTO usuario (nombres, apellidos, correo, telefono, contrasena_hash, rol, municipio) VALUES
          ('Rosa', 'P', 'rosa@prueba.co', '3000000001', 'h', 'PRODUCTOR', 'Pamplonita'),
          ('Andrés', 'C', 'andres@prueba.co', '3000000002', 'h', 'CONSUMIDOR', 'Cúcuta')
        RETURNING id_usuario`);
      const [prod, cons] = u.rows.map((r) => r.id_usuario);
      const p = await client.query(`
        INSERT INTO pedido (id_consumidor, id_productor, clave_idempotencia, total, punto_entrega, franja_entrega)
        VALUES ($1, $2, gen_random_uuid(), 1000, 'Parque', 'Mañana') RETURNING id_pedido`, [cons, prod]);
      await expect(client.query("UPDATE pedido SET estado = 'ENTREGADO' WHERE id_pedido = $1", [p.rows[0].id_pedido]))
        .rejects.toMatchObject({ code: 'P0001' });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('CORS de desarrollo', () => {
  test('solo responde con cabeceras CORS a orígenes permitidos', async () => {
    const { cors } = require('../../src/middleware/cors');
    const express = require('express');
    const a = express();
    a.use(cors(['http://localhost:8081']));
    a.get('/x', (req, res) => res.json({ ok: true }));
    const permitido = await request(a).get('/x').set('Origin', 'http://localhost:8081');
    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const ajeno = await request(a).get('/x').set('Origin', 'http://evil.example');
    expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
  });
});
