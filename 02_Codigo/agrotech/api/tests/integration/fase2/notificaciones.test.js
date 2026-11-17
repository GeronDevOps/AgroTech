'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { migrate } = require('../../../src/db/migrate');
const config = require('../../../src/config/env');
const { entornoFase2, pool } = require('./comun');

/** FCM simulado (como en push.test.js). */
const enviados = [];
const fcm = { enviar: jest.fn(async (m) => { enviados.push(m); return 'ENVIADA'; }) };

const conPush = entornoFase2({ fcm });
const sinPush = entornoFase2({ fcm: null });
let rosa; let andres; let papa;

beforeAll(async () => { await migrate({ log: () => {} }); });
beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  enviados.length = 0;
  rosa = await conPush.cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await conPush.cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  papa = await conPush.producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
  await conPush.post(andres.token, '/dispositivos', { token: 'fcm-andres-0123456789-abcdefghijklmnop' });
  await conPush.post(rosa.token, '/dispositivos', { token: 'fcm-rosa-0123456789-abcdefghijklmnopq' });
});
afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-16 · Notificaciones push de pedidos y mensajes (RF-16 · AGRO-27)', () => {
  test('CP-28: cambio de estado, mensaje y cancelación llegan como push con lo necesario para abrir la pantalla', async () => {
    const p = await conPush.pedido(andres.token, papa.id, 1);
    await conPush.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'ACEPTADO' });
    await conPush.hasta(async () => enviados.some((m) => m.datos.tipo === 'PEDIDO_ACEPTADO'));
    expect(enviados.find((m) => m.datos.tipo === 'PEDIDO_ACEPTADO')).toMatchObject({
      token: 'fcm-andres-0123456789-abcdefghijklmnop', titulo: '✅ Pedido aceptado', datos: { idPedido: p.id },
    });

    await conPush.post(rosa.token, `/pedidos/${p.id}/mensajes`, { id: crypto.randomUUID(), contenido: 'Mañana le llevo la papa a las 9' });
    await conPush.hasta(async () => enviados.some((m) => m.datos.tipo === 'MENSAJE'));
    expect(enviados.find((m) => m.datos.tipo === 'MENSAJE')).toMatchObject({ titulo: '💬 Rosa P.', cuerpo: 'Mañana le llevo la papa a las 9', datos: { idPedido: p.id, abrir: 'CHAT' } });

    await conPush.post(andres.token, `/pedidos/${p.id}/cancelar`, { motivo: 'Ya compré en la plaza' });
    await conPush.hasta(async () => enviados.some((m) => m.datos.tipo === 'PEDIDO_CANCELADO'));
    const cancelado = enviados.find((m) => m.datos.tipo === 'PEDIDO_CANCELADO');
    expect(cancelado.token).toBe('fcm-rosa-0123456789-abcdefghijklmnopq'); // solo la contraparte
    expect(cancelado.cuerpo).toContain('Ya compré en la plaza');
  });

  test('A1/A3: todo aviso queda en la bandeja interna; se cuentan y marcan los no leídos', async () => {
    const p = await conPush.pedido(andres.token, papa.id, 1);
    await conPush.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'ACEPTADO' });
    await conPush.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'EN_CAMINO' });
    await conPush.hasta(async () => (await conPush.get(andres.token, '/notificaciones')).body.sinLeer === 2);
    const b = (await conPush.get(andres.token, '/notificaciones')).body;
    expect(b.notificaciones.map((n) => n.tipo)).toEqual(['PEDIDO_EN_CAMINO', 'PEDIDO_ACEPTADO']);
    await conPush.post(andres.token, '/notificaciones/leidas', { ids: [b.notificaciones[0].id] });
    expect((await conPush.get(andres.token, '/notificaciones')).body.sinLeer).toBe(1);
    await conPush.post(andres.token, '/notificaciones/leidas');
    expect((await conPush.get(andres.token, '/notificaciones')).body.sinLeer).toBe(0);
  });

  test('sin FCM configurado el aviso queda SOLO_BANDEJA (no se pierde)', async () => {
    const p = await sinPush.pedido(andres.token, papa.id, 1);
    await sinPush.patch(rosa.token, `/pedidos/${p.id}/estado`, { estado: 'ACEPTADO' });
    await sinPush.hasta(async () => (await pool.query("SELECT 1 FROM notificacion WHERE tipo = 'PEDIDO_ACEPTADO' AND estado_envio = 'SOLO_BANDEJA'")).rowCount === 1);
  });
});
