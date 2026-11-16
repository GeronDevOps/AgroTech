'use strict';

const crypto = require('node:crypto');
const { createFcm, ErrorTemporalFcm } = require('../../src/modules/notificaciones/fcm');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const cuentaServicio = {
  project_id: 'agrotech-pruebas',
  client_email: 'push@agrotech-pruebas.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};
const respuesta = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });

function fetchFalso(respuestasFcm) {
  const llamadas = [];
  const fetch = jest.fn(async (url, opciones) => {
    llamadas.push({ url, opciones });
    if (url.startsWith('https://oauth2')) return respuesta(200, { access_token: `acceso-${llamadas.length}`, expires_in: 3600 });
    return respuestasFcm.shift() || respuesta(200, { name: 'projects/x/messages/1' });
  });
  return { fetch, llamadas };
}

describe('Cliente FCM HTTP v1 (RF-16a)', () => {
  test('firma el JWT de la cuenta de servicio con RS256 y envía el mensaje con prioridad alta', async () => {
    const { fetch, llamadas } = fetchFalso([]);
    const fcm = createFcm({ cuentaServicio, fetch, ahora: () => Date.parse('2026-10-11T12:00:00Z') });
    expect(await fcm.enviar({ token: 'tok-1', titulo: 'Nuevo pedido', cuerpo: 'Andrés pidió papa', datos: { idPedido: 'p-1', n: 2 } })).toBe('ENVIADA');

    const asercion = new URLSearchParams(llamadas[0].opciones.body).get('assertion');
    const [cab, cuerpo, firma] = asercion.split('.');
    expect(crypto.verify('RSA-SHA256', Buffer.from(`${cab}.${cuerpo}`), publicKey, Buffer.from(firma, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(cuerpo, 'base64url'))).toMatchObject({
      iss: cuentaServicio.client_email, aud: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/firebase.messaging',
    });

    expect(llamadas[1].url).toBe('https://fcm.googleapis.com/v1/projects/agrotech-pruebas/messages:send');
    expect(llamadas[1].opciones.headers.Authorization).toBe('Bearer acceso-1');
    expect(JSON.parse(llamadas[1].opciones.body).message).toEqual({
      token: 'tok-1',
      notification: { title: 'Nuevo pedido', body: 'Andrés pidió papa' },
      data: { idPedido: 'p-1', n: '2' },
      android: { priority: 'high', notification: { channel_id: 'pedidos', sound: 'default' } },
    });
  });

  test('reutiliza el token OAuth mientras está vigente', async () => {
    const { fetch, llamadas } = fetchFalso([]);
    const fcm = createFcm({ cuentaServicio, fetch });
    await fcm.enviar({ token: 'a', titulo: 't', cuerpo: 'c' });
    await fcm.enviar({ token: 'b', titulo: 't', cuerpo: 'c' });
    expect(llamadas.filter((l) => l.url.startsWith('https://oauth2'))).toHaveLength(1);
  });

  test('token del teléfono no registrado → TOKEN_INVALIDO; 5xx o sin red → ErrorTemporalFcm', async () => {
    const { fetch } = fetchFalso([
      respuesta(404, { error: { status: 'NOT_FOUND' } }),
      respuesta(400, { error: { status: 'INVALID_ARGUMENT' } }),
      respuesta(503, { error: { status: 'UNAVAILABLE' } }),
    ]);
    const fcm = createFcm({ cuentaServicio, fetch });
    expect(await fcm.enviar({ token: 'x', titulo: 't', cuerpo: 'c' })).toBe('TOKEN_INVALIDO');
    expect(await fcm.enviar({ token: 'x', titulo: 't', cuerpo: 'c' })).toBe('TOKEN_INVALIDO');
    await expect(fcm.enviar({ token: 'x', titulo: 't', cuerpo: 'c' })).rejects.toBeInstanceOf(ErrorTemporalFcm);
    const sinRed = createFcm({ cuentaServicio, fetch: jest.fn(async () => { throw new TypeError('fetch failed'); }) });
    await expect(sinRed.enviar({ token: 'x', titulo: 't', cuerpo: 'c' })).rejects.toBeInstanceOf(ErrorTemporalFcm);
  });
});
