'use strict';

const { migrate } = require('../../../src/db/migrate');
const config = require('../../../src/config/env');
const { entornoFase2, pool } = require('./comun');

const e = entornoFase2();
const codigoDelCorreo = () => /: (\d{6})$/.exec(e.correo.enviados[e.correo.enviados.length - 1].asunto)[1];

beforeAll(async () => { await migrate({ log: () => {} }); });
beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  e.correo.enviados.length = 0;
});
afterAll(async () => { await pool.end(); });

describe('CU-08 · Recuperar la contraseña (RF-08 · AGRO-22)', () => {
  test('CP-20: código por correo, nueva contraseña, sesiones anteriores cerradas', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    expect((await e.get(rosa.token, '/auth/yo')).status).toBe(200);

    const r = await e.publico('post', '/auth/recuperar', { correo: 'ROSA@correo.co' });
    expect(r.status).toBe(202);
    expect(r.body.mensaje).toMatch(/Si el correo está registrado/);
    await e.hasta(async () => e.correo.enviados.length === 1);
    expect(e.correo.enviados[0]).toMatchObject({ para: 'rosa@correo.co' });
    const codigo = codigoDelCorreo();
    const { rows: [fila] } = await pool.query('SELECT codigo_hash, expira_en - creado_en AS vigencia FROM recuperacion_contrasena');
    expect(fila.codigo_hash).not.toContain(codigo); // solo el hash
    expect(fila.vigencia.minutes).toBe(15);

    const ok = await e.publico('post', '/auth/restablecer', { correo: 'rosa@correo.co', codigo, contrasena: 'nuevaClave2026' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ tipo: 'Bearer', usuario: { rol: 'PRODUCTOR' } });

    // Paso 4: el token viejo deja de valer; el nuevo y la nueva contraseña sí.
    const viejo = await e.get(rosa.token, '/auth/yo');
    expect(viejo.status).toBe(401);
    expect(viejo.body.error.codigo).toBe('SESION_EXPIRADA');
    expect((await e.get(ok.body.token, '/auth/yo')).status).toBe(200);
    expect((await e.publico('post', '/auth/sesion', { identificador: 'rosa@correo.co', contrasena: 'cosecha2026' })).status).toBe(401);
    expect((await e.publico('post', '/auth/sesion', { identificador: 'rosa@correo.co', contrasena: 'nuevaClave2026' })).status).toBe(200);
    // El código es de un solo uso.
    expect((await e.publico('post', '/auth/restablecer', { correo: 'rosa@correo.co', codigo, contrasena: 'otraClave2026' })).body.error.codigo).toBe('CODIGO_INVALIDO');
    expect((await e.bitacora('CONTRASENA_RESTABLECIDA'))).toHaveLength(1);
  });

  test('A1: correo no registrado → mismo mensaje neutro y ningún correo', async () => {
    const r = await e.publico('post', '/auth/recuperar', { correo: 'nadie@correo.co' });
    expect(r.status).toBe(202);
    expect(r.body.mensaje).toMatch(/Si el correo está registrado/);
    await new Promise((res) => setTimeout(res, 100));
    expect(e.correo.enviados).toHaveLength(0);
  });

  test('A2: tres códigos equivocados invalidan el código y el proceso se reinicia', async () => {
    await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    await e.publico('post', '/auth/recuperar', { correo: 'rosa@correo.co' });
    await e.hasta(async () => e.correo.enviados.length === 1);
    const bueno = codigoDelCorreo();
    const malo = bueno === '000000' ? '111111' : '000000';
    const intento = () => e.publico('post', '/auth/restablecer', { correo: 'rosa@correo.co', codigo: malo, contrasena: 'nuevaClave2026' });
    expect((await intento()).body.error).toMatchObject({ codigo: 'CODIGO_INCORRECTO', detalles: { intentosRestantes: 2 } });
    expect((await intento()).body.error).toMatchObject({ codigo: 'CODIGO_INCORRECTO', detalles: { intentosRestantes: 1 } });
    expect((await intento()).body.error.codigo).toBe('CODIGO_AGOTADO');
    // Ni el código correcto sirve ya.
    expect((await e.publico('post', '/auth/restablecer', { correo: 'rosa@correo.co', codigo: bueno, contrasena: 'nuevaClave2026' })).body.error.codigo).toBe('CODIGO_INVALIDO');
  });

  test('A2: código vencido (15 minutos) → CODIGO_VENCIDO', async () => {
    await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    await e.publico('post', '/auth/recuperar', { correo: 'rosa@correo.co' });
    await e.hasta(async () => e.correo.enviados.length === 1);
    await pool.query("UPDATE recuperacion_contrasena SET expira_en = now() - interval '1 second'");
    const r = await e.publico('post', '/auth/restablecer', { correo: 'rosa@correo.co', codigo: codigoDelCorreo(), contrasena: 'nuevaClave2026' });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('CODIGO_VENCIDO');
  });

  test('A3: contraseña débil → muestra la política de contraseñas', async () => {
    await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const r = await e.publico('post', '/auth/restablecer', { correo: 'rosa@correo.co', codigo: '123456', contrasena: 'corta' });
    expect(r.status).toBe(400);
    expect(r.body.error.detalles.campos.contrasena).toMatch(/entre 8 y 72 caracteres, con letras y números/);
  });

  test('un código nuevo invalida el anterior y no se envían dos correos en menos de un minuto', async () => {
    await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    await e.publico('post', '/auth/recuperar', { correo: 'rosa@correo.co' });
    await e.publico('post', '/auth/recuperar', { correo: 'rosa@correo.co' });
    await e.hasta(async () => e.correo.enviados.length >= 1);
    await new Promise((res) => setTimeout(res, 100));
    expect(e.correo.enviados).toHaveLength(1);
    await pool.query("UPDATE recuperacion_contrasena SET creado_en = now() - interval '2 minutes'");
    await e.publico('post', '/auth/recuperar', { correo: 'rosa@correo.co' });
    await e.hasta(async () => e.correo.enviados.length === 2);
    const { rows } = await pool.query('SELECT count(*) FILTER (WHERE invalidado_en IS NULL AND usado_en IS NULL)::int AS vigentes, count(*)::int AS total FROM recuperacion_contrasena');
    expect(rows[0]).toEqual({ vigentes: 1, total: 2 });
  });
});

describe('CU-20 A3 · Nuevo aviso de privacidad (RF-20)', () => {
  test('si cambió la versión del aviso, la sesión lo indica y se registra la nueva autorización', async () => {
    const andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000');
    await pool.query("UPDATE autorizacion_datos SET version_aviso = '0.9'");
    const sesion = await e.publico('post', '/auth/sesion', { identificador: '3205550000', contrasena: 'cosecha2026' });
    expect(sesion.body).toMatchObject({ requiereAutorizacion: true, versionAviso: config.auth.versionAvisoPrivacidad });
    expect((await e.post(andres.token, '/auth/autorizacion', { version: '0.1' })).status).toBe(400);
    const ok = await e.post(andres.token, '/auth/autorizacion', { version: config.auth.versionAvisoPrivacidad });
    expect(ok.status).toBe(200);
    expect(ok.body.requiereAutorizacion).toBe(false);
    expect((await pool.query('SELECT count(*)::int AS n FROM autorizacion_datos')).rows[0].n).toBe(2);
  });
});
