'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const request = require('supertest');
const { migrate } = require('../../../src/db/migrate');
const config = require('../../../src/config/env');
const { jpeg } = require('../ayudas');
const { entornoFase2, pool } = require('./comun');

const e = entornoFase2();
const { privacidadService } = e.servicios;
const coordenadas = async (id) => (await pool.query('SELECT ST_Y(coordenadas::geometry) AS lat, ST_X(coordenadas::geometry) AS lon FROM usuario WHERE id_usuario = $1', [id])).rows[0];

beforeAll(async () => { await migrate({ log: () => {} }); });
beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  e.correo.enviados.length = 0;
});
afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-09 · Gestionar el perfil (RF-09 · AGRO-23)', () => {
  test('CP-21: actualiza contacto y municipio, recalcula las coordenadas y registra en bitácora', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234', 'Pamplonita');
    const antes = await coordenadas(rosa.id);
    expect(antes.lat).toBeCloseTo(7.4378, 3); // registro: cabecera de su municipio

    const r = await e.patch(rosa.token, '/perfil', { telefono: '311 444 5566', municipio: 'chinacota', veredaDireccion: 'Vereda La Nueva' });
    expect(r.status).toBe(200);
    expect(r.body.perfil).toMatchObject({ telefono: '3114445566', municipio: 'Chinácota', veredaDireccion: 'Vereda La Nueva', ubicacion: { origen: 'MUNICIPIO' } });
    expect((await coordenadas(rosa.id)).lat).toBeCloseTo(7.6031, 3);

    // Con permiso del teléfono se guarda el punto exacto.
    const gps = await e.patch(rosa.token, '/perfil', { ubicacion: { lat: 7.61, lon: -72.6 } });
    expect(gps.body.perfil.ubicacion).toEqual({ lat: 7.61, lon: -72.6, origen: 'TELEFONO' });
    expect((await e.bitacora('PERFIL_ACTUALIZADO'))).toHaveLength(2);
    expect((await e.get(rosa.token, '/auth/yo')).body.usuario.telefono).toBe('3114445566');
  });

  test('A1: el rol no se puede cambiar desde el perfil', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const r = await e.patch(rosa.token, '/perfil', { rol: 'CONSUMIDOR', nombres: 'Rosita' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ROL_NO_EDITABLE');
    expect((await e.get(rosa.token, '/perfil')).body.perfil).toMatchObject({ rol: 'PRODUCTOR', nombres: 'Rosa' });
  });

  test('A2: celular o correo de otra cuenta → 409 DATO_EN_USO y no cambia nada', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    await e.cuenta('Andres', 'CONSUMIDOR', '3205550000');
    const tel = await e.patch(rosa.token, '/perfil', { telefono: '3205550000', nombres: 'Rosita' });
    expect(tel.status).toBe(409);
    expect(tel.body.error).toMatchObject({ codigo: 'DATO_EN_USO', detalles: { campo: 'telefono' } });
    const correo = await e.patch(rosa.token, '/perfil', { correo: 'andres@correo.co' });
    expect(correo.body.error.detalles.campo).toBe('correo');
    expect((await e.get(rosa.token, '/perfil')).body.perfil.nombres).toBe('Rosa');
  });

  test('validaciones: municipio fuera del departamento, ubicación lejana, sin cambios', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    expect((await e.patch(rosa.token, '/perfil', { municipio: 'Medellín' })).body.error.detalles.campos).toHaveProperty('municipio');
    expect((await e.patch(rosa.token, '/perfil', { ubicacion: { lat: 4.6, lon: -74.08 } })).body.error.detalles.campos).toHaveProperty('ubicacion');
    expect((await e.patch(rosa.token, '/perfil', {})).status).toBe(400);
  });

  test('A3 sin señal: PERFIL.EDITAR por /sync/push', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const r = await e.post(rosa.token, '/sync/push', { operaciones: [{ idOperacion: crypto.randomUUID(), tipo: 'PERFIL.EDITAR', datos: { veredaDireccion: 'Vereda El Volcán' } }] });
    expect(r.body.resultados[0]).toMatchObject({ resultado: 'PUBLICADO', perfil: { veredaDireccion: 'Vereda El Volcán' } });
  });

  test('foto de perfil: JPEG ≤ 300 KB; la anterior se reemplaza', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const subir = (buf) => request(e.app).put('/api/v1/perfil/foto').set('Authorization', `Bearer ${rosa.token}`).attach('foto', buf, { filename: 'f.jpg', contentType: 'image/jpeg' });
    const r = await subir(jpeg(4096));
    expect(r.status).toBe(200);
    expect(r.body.perfil.fotoUrl).toMatch(/\/fotos\/perfiles\/.+\.jpg$/);
    expect((await subir(Buffer.from('no es una foto'))).status).toBe(400);
  });
});

describe('CU-20 · Gestionar datos personales (RF-20 · AGRO-23)', () => {
  test('consulta sus datos, finalidades y la autorización otorgada', async () => {
    const andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
    const r = await e.get(andres.token, '/privacidad');
    expect(r.status).toBe(200);
    expect(r.body.datos).toMatchObject({ correo: 'andres@correo.co', telefono: '3205550000', municipio: 'Cúcuta' });
    expect(r.body.autorizaciones).toEqual([expect.objectContaining({ version: '1.0', canal: 'APP' })]);
    expect(r.body.finalidades.length).toBeGreaterThan(0);
    expect(r.body.supresion).toMatchObject({ solicitud: null, plazoDiasHabiles: 15 });
  });

  test('CP-22: sin pedidos en curso la supresión anonimiza la cuenta y conserva las transacciones', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
    const papa = await e.producto(rosa.token, { nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 10 });
    const pedido = await e.pedido(andres.token, papa.id, 1);
    await e.entregar(rosa.token, pedido.id);

    expect((await e.post(andres.token, '/privacidad/supresion', {})).status).toBe(400); // exige confirmar
    const r = await e.post(andres.token, '/privacidad/supresion', { confirmar: true, motivo: 'Ya no uso la app' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sesionCerrada: true, solicitud: { estado: 'COMPLETADA' } });
    expect(r.body.solicitud.fechaLimite).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const { rows: [u] } = await pool.query('SELECT nombres, correo, telefono, estado, coordenadas FROM usuario WHERE id_usuario = $1', [andres.id]);
    expect(u).toMatchObject({ nombres: 'Usuario', estado: 'ANONIMIZADA', coordenadas: null });
    expect(u.correo).toMatch(/@agrotech\.invalid$/);
    expect(u.telefono).toMatch(/^ANON/);
    // La transacción se conserva sin identificación.
    const { rows: [p] } = await pool.query('SELECT estado, total, punto_entrega FROM pedido WHERE id_pedido = $1', [pedido.id]);
    expect(p).toMatchObject({ estado: 'ENTREGADO', punto_entrega: 'Dato suprimido' });
    // Sesión cerrada, no puede volver a entrar, se le avisó por correo.
    expect((await e.get(andres.token, '/auth/yo')).status).toBe(401);
    expect((await e.publico('post', '/auth/sesion', { identificador: 'andres@correo.co', contrasena: 'cosecha2026' })).status).toBe(401);
    expect(e.correo.enviados.map((c) => c.para)).toContain('andres@correo.co');
    expect((await e.bitacora('SUPRESION_DATOS'))).toHaveLength(1);
  });

  test('A1: con pedidos en curso se aplaza; al terminar los pedidos la tarea la completa', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000');
    const papa = await e.producto(rosa.token, { nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 10 });
    const pedido = await e.pedido(andres.token, papa.id, 1);
    const r = await e.post(andres.token, '/privacidad/supresion', { confirmar: true });
    expect(r.status).toBe(202);
    expect(r.body.solicitud.estado).toBe('APLAZADA');
    expect((await e.post(andres.token, '/privacidad/supresion', { confirmar: true })).body.error.codigo).toBe('SOLICITUD_EN_TRAMITE');
    expect(await privacidadService.procesarAplazadas()).toEqual([]); // pedido aún en curso
    await e.entregar(rosa.token, pedido.id);
    expect(await privacidadService.procesarAplazadas()).toHaveLength(1);
    expect((await pool.query('SELECT estado FROM usuario WHERE id_usuario = $1', [andres.id])).rows[0].estado).toBe('ANONIMIZADA');
  });

  test('A2: el usuario desiste mientras está aplazada', async () => {
    const rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
    const andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000');
    const papa = await e.producto(rosa.token, { nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 10 });
    await e.pedido(andres.token, papa.id, 1);
    await e.post(andres.token, '/privacidad/supresion', { confirmar: true });
    const d = await e.del(andres.token, '/privacidad/supresion');
    expect(d.status).toBe(200);
    expect(d.body.solicitud.estado).toBe('DESISTIDA');
    expect((await e.del(andres.token, '/privacidad/supresion')).status).toBe(404);
    expect((await e.get(andres.token, '/auth/yo')).status).toBe(200);
  });
});
