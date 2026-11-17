'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { ErrorTemporalFcm } = require('../../src/modules/notificaciones/fcm');
const { crearAyudas, eventoWompi } = require('./ayudas');
const { vaciarUsuarios } = require('./limpiar');

/** FCM simulado: cada token responde según `comportamiento[token]` ('ok' | 'invalido' | 'temporal'). */
const comportamiento = {};
const enviados = [];
const fcm = {
  enviar: jest.fn(async (m) => {
    const c = comportamiento[m.token] || 'ok';
    if (c === 'temporal') throw new ErrorTemporalFcm('FCM respondió 503');
    if (c === 'invalido') return 'TOKEN_INVALIDO';
    enviados.push(m);
    return 'ENVIADA';
  }),
};

const app = createApp({ pool, fcm });
const { cuenta, producto, confirmar, post, hasta } = crearAyudas(app);
const { notificacionesService } = app.locals.servicios;
const uuid = () => crypto.randomUUID();
const TOKEN_ROSA = 'fcm-rosa-0123456789-abcdefghijklmnop';
const notificaciones = async () => (await pool.query('SELECT tipo, estado_envio, intentos, datos, proximo_intento > now() AS espera FROM notificacion ORDER BY creado_en')).rows;

let rosa; let andres; let papa;

beforeAll(async () => { await migrate({ log: () => {} }); });

beforeEach(async () => {
  await vaciarUsuarios(pool);
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  Object.keys(comportamiento).forEach((k) => delete comportamiento[k]);
  enviados.length = 0;
  fcm.enviar.mockClear();
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

const pedir = async (body = {}) => (await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 2 }], ...body })).body.pedidos[0];

describe('RF-16a · Aviso push de nuevo pedido al productor (AGRO-20)', () => {
  test('CA-06: el productor recibe el aviso en su teléfono con el pedido para abrirlo', async () => {
    await post(rosa.token, '/dispositivos', { token: TOKEN_ROSA });
    const pedido = await pedir();
    await hasta(async () => enviados.length === 1);
    expect(enviados[0]).toEqual({
      token: TOKEN_ROSA,
      titulo: '🧺 Nuevo pedido',
      cuerpo: 'Andres P. pidió Papa pastusa · $ 170.000. Ábralo para aceptarlo.',
      datos: { idPedido: pedido.id, tipo: 'PEDIDO_NUEVO' },
    });
    await hasta(async () => (await notificaciones())[0]?.estado_envio === 'ENVIADA');
  });

  test('CU-16 A1: sin teléfono registrado queda SIN_DISPOSITIVO (el aviso llega dentro de la app)', async () => {
    await pedir();
    await hasta(async () => (await notificaciones())[0]?.estado_envio === 'SIN_DISPOSITIVO');
    expect(fcm.enviar).not.toHaveBeenCalled();
  });

  test('CU-16 A2: un token vencido se marca INVALIDO y no se vuelve a usar', async () => {
    await post(rosa.token, '/dispositivos', { token: TOKEN_ROSA });
    comportamiento[TOKEN_ROSA] = 'invalido';
    await pedir();
    await hasta(async () => (await notificaciones())[0]?.estado_envio === 'SIN_DISPOSITIVO');
    expect((await pool.query('SELECT estado FROM dispositivo WHERE token = $1', [TOKEN_ROSA])).rows[0].estado).toBe('INVALIDO');
  });

  test('CU-04 A4: si FCM falla, el pedido se mantiene y el aviso se reintenta con espera creciente hasta FALLIDA', async () => {
    await post(rosa.token, '/dispositivos', { token: TOKEN_ROSA });
    comportamiento[TOKEN_ROSA] = 'temporal';
    const pedido = await pedir();
    expect(pedido.estado).toBe('PENDIENTE');
    await hasta(async () => (await notificaciones())[0]?.intentos === 1);
    expect((await notificaciones())[0]).toMatchObject({ estado_envio: 'PENDIENTE', espera: true });

    // La tarea de cada minuto no lo toma antes de su turno.
    expect(await notificacionesService.procesarPendientes()).toEqual([]);
    for (let i = 2; i <= 5; i += 1) {
      await pool.query("UPDATE notificacion SET proximo_intento = now() - interval '1 second'");
      await notificacionesService.procesarPendientes();
    }
    expect((await notificaciones())[0]).toMatchObject({ estado_envio: 'FALLIDA', intentos: 5 });
  });

  test('un reintento que sí sale queda ENVIADA', async () => {
    await post(rosa.token, '/dispositivos', { token: TOKEN_ROSA });
    comportamiento[TOKEN_ROSA] = 'temporal';
    await pedir();
    await hasta(async () => (await notificaciones())[0]?.intentos === 1);
    delete comportamiento[TOKEN_ROSA];
    await pool.query("UPDATE notificacion SET proximo_intento = now() - interval '1 second'");
    expect(await notificacionesService.procesarPendientes()).toEqual(['ENVIADA']);
    expect(enviados).toHaveLength(1);
  });

  test('RF-21: con el pago en línea aprobado, el productor recibe "Pedido pagado"', async () => {
    await post(rosa.token, '/dispositivos', { token: TOKEN_ROSA });
    const pedido = await pedir({ metodoPago: 'EN_LINEA' });
    const pago = (await post(andres.token, `/pedidos/${pedido.id}/pago`)).body.pago;
    await require('supertest')(app).post('/api/v1/pagos/wompi/eventos')
      .send(eventoWompi({ status: 'APPROVED', reference: pago.referencia, amount: pago.montoCentavos, secreto: config.wompi.secretoEventos }));
    await hasta(async () => enviados.some((e) => e.datos.tipo === 'PEDIDO_PAGADO'));
    expect(enviados.find((e) => e.datos.tipo === 'PEDIDO_PAGADO')).toMatchObject({ titulo: '💳 Pedido pagado', datos: { idPedido: pedido.id } });
  });
});
