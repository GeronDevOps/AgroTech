'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { vaciarUsuarios } = require('./limpiar');

const app = createApp({ pool });

const rosa = {
  nombres: 'Rosa', apellidos: 'Peñaranda', correo: 'rosa@correo.co', telefono: '310 555 1234',
  contrasena: 'cosecha2026', rol: 'PRODUCTOR', municipio: 'Pamplonita', veredaDireccion: 'Vereda El Diamante',
  aceptaTratamientoDatos: true,
};

const registrar = (datos = rosa) => request(app).post('/api/v1/auth/registro').send(datos);
const iniciar = (identificador, contrasena) => request(app).post('/api/v1/auth/sesion').send({ identificador, contrasena });

beforeAll(async () => {
  await migrate({ log: () => {} });
});

beforeEach(async () => {
  await vaciarUsuarios(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/v1/auth/registro (CU-01)', () => {
  test('CP-01: crea la cuenta con su rol, guarda la autorización y abre la sesión', async () => {
    const res = await registrar();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'Bearer', usuario: { rol: 'PRODUCTOR', telefono: '3105551234', municipio: 'Pamplonita' } });
    expect(res.body.usuario).not.toHaveProperty('contrasena_hash');

    const id = res.body.usuario.id;
    expect(jwt.decode(res.body.token)).toMatchObject({ sub: id, rol: 'PRODUCTOR' });

    const { rows: [u] } = await pool.query('SELECT contrasena_hash FROM usuario WHERE id_usuario = $1', [id]);
    expect(u.contrasena_hash).toMatch(/^\$2[aby]\$/); // Bcrypt, nunca la contraseña (RNF-04)
    const aut = await pool.query('SELECT version_aviso, canal FROM autorizacion_datos WHERE id_usuario = $1', [id]);
    expect(aut.rows).toEqual([{ version_aviso: '1.0', canal: 'APP' }]);
    const bit = await pool.query("SELECT accion, resultado FROM bitacora WHERE id_usuario = $1", [id]);
    expect(bit.rows).toEqual([{ accion: 'REGISTRO', resultado: 'EXITOSO' }]);
  });

  test('A1: correo ya registrado → 409 CUENTA_EXISTENTE', async () => {
    await registrar();
    const res = await registrar({ ...rosa, telefono: '3115550000', correo: 'ROSA@correo.co' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ codigo: 'CUENTA_EXISTENTE', detalles: { campo: 'correo' } });
  });

  test('A3: sin autorización de datos no crea la cuenta', async () => {
    const res = await registrar({ ...rosa, aceptaTratamientoDatos: false });
    expect(res.status).toBe(400);
    expect(res.body.error.detalles.campos).toHaveProperty('aceptaTratamientoDatos');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuario');
    expect(rows[0].n).toBe(0);
  });

  test('no permite registrarse como administrador', async () => {
    const res = await registrar({ ...rosa, rol: 'ADMINISTRADOR' });
    expect(res.status).toBe(400);
    expect(res.body.error.detalles.campos).toHaveProperty('rol');
  });
});

describe('POST /api/v1/auth/sesion (CU-21)', () => {
  test('CA-01: inicia sesión con correo o con celular', async () => {
    await registrar();
    const porCorreo = await iniciar('Rosa@Correo.co', 'cosecha2026');
    expect(porCorreo.status).toBe(200);
    expect(porCorreo.body.usuario.rol).toBe('PRODUCTOR');
    const porCelular = await iniciar('310-555-1234', 'cosecha2026');
    expect(porCelular.status).toBe(200);
  });

  test('CA-02: correo no registrado y contraseña errada dan el mismo mensaje', async () => {
    await registrar();
    const noExiste = await iniciar('nadie@correo.co', 'cosecha2026');
    const errada = await iniciar('rosa@correo.co', 'otra12345');
    expect(noExiste.status).toBe(401);
    expect(errada.status).toBe(401);
    expect(noExiste.body).toEqual(errada.body);
    expect(errada.body.error.mensaje).toBe('Credenciales inválidas.');
  });

  test('CP-02: 5 intentos fallidos bloquean 15 minutos, aun con la contraseña correcta', async () => {
    const { body } = await registrar();
    for (let i = 1; i <= 4; i += 1) expect((await iniciar('rosa@correo.co', 'mala12345')).status).toBe(401);

    const quinto = await iniciar('rosa@correo.co', 'mala12345');
    expect(quinto.status).toBe(423);
    expect(quinto.body.error.codigo).toBe('CUENTA_BLOQUEADA');
    const minutos = (new Date(quinto.body.error.detalles.bloqueadoHasta) - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);

    expect((await iniciar('rosa@correo.co', 'cosecha2026')).status).toBe(423);

    const bit = await pool.query(
      "SELECT accion, resultado FROM bitacora WHERE id_usuario = $1 AND accion <> 'REGISTRO' ORDER BY fecha, accion",
      [body.usuario.id],
    );
    expect(bit.rows.filter((r) => r.resultado === 'FALLIDO')).toHaveLength(5);
    expect(bit.rows).toContainEqual({ accion: 'BLOQUEO_CUENTA', resultado: 'EXITOSO' });
    expect(bit.rows).toContainEqual({ accion: 'INICIO_SESION', resultado: 'BLOQUEADO' });
  });

  test('al vencer el bloqueo puede ingresar y los contadores se reinician', async () => {
    const { body } = await registrar();
    for (let i = 1; i <= 5; i += 1) await iniciar('rosa@correo.co', 'mala12345');
    await pool.query("UPDATE usuario SET bloqueado_hasta = now() - interval '1 minute' WHERE id_usuario = $1", [body.usuario.id]);

    expect((await iniciar('rosa@correo.co', 'cosecha2026')).status).toBe(200);
    const { rows: [u] } = await pool.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE id_usuario = $1', [body.usuario.id]);
    expect(u).toEqual({ intentos_fallidos: 0, bloqueado_hasta: null });
  });

  test('cuenta suspendida → 403 (A2)', async () => {
    const { body } = await registrar();
    await pool.query("UPDATE usuario SET estado = 'SUSPENDIDA' WHERE id_usuario = $1", [body.usuario.id]);
    const res = await iniciar('rosa@correo.co', 'cosecha2026');
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('CUENTA_SUSPENDIDA');
  });
});

describe('GET /api/v1/auth/yo (token JWT)', () => {
  test('con token válido devuelve el perfil', async () => {
    const { body } = await registrar();
    const res = await request(app).get('/api/v1/auth/yo').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario.correo).toBe('rosa@correo.co');
  });

  test('sin token, alterado o vencido → 401', async () => {
    const { body } = await registrar();
    const sinToken = await request(app).get('/api/v1/auth/yo');
    expect(sinToken.body.error.codigo).toBe('NO_AUTENTICADO');

    const alterado = await request(app).get('/api/v1/auth/yo').set('Authorization', `Bearer ${body.token}x`);
    expect(alterado.status).toBe(401);

    const vencido = jwt.sign({ rol: 'PRODUCTOR' }, config.auth.jwtSecreto, {
      subject: body.usuario.id, issuer: 'agrotech-api', audience: 'agrotech-app', expiresIn: -10,
    });
    const res = await request(app).get('/api/v1/auth/yo').set('Authorization', `Bearer ${vencido}`);
    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe('SESION_EXPIRADA');
  });

  test('token firmado con otro secreto → 401', async () => {
    const falso = jwt.sign({ rol: 'ADMINISTRADOR' }, 'otro-secreto-cualquiera-de-32-caracteres', {
      subject: '00000000-0000-0000-0000-000000000000', issuer: 'agrotech-api', audience: 'agrotech-app',
    });
    const res = await request(app).get('/api/v1/auth/yo').set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
  });
});
