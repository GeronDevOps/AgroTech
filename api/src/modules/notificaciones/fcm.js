'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';

const b64url = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

/** Error temporal de entrega (red, 429, 5xx): la notificación se reintenta más tarde. */
class ErrorTemporalFcm extends Error {}

/**
 * Cliente de Firebase Cloud Messaging (API HTTP v1) con la cuenta de servicio del proyecto.
 * Firma el JWT de la cuenta de servicio con RS256 (node:crypto), lo cambia por un token OAuth 2.0
 * (válido 1 h, se reutiliza) y envía un mensaje por token de dispositivo.
 * Resultado de enviar(): 'ENVIADA' | 'TOKEN_INVALIDO'; lanza ErrorTemporalFcm si conviene reintentar.
 */
function createFcm({ cuentaServicio, fetch = globalThis.fetch, ahora = () => Date.now() }) {
  const { project_id: proyecto, client_email: correo, private_key: llave } = cuentaServicio;
  let acceso = null; // { token, vence }

  async function tokenAcceso() {
    if (acceso && acceso.vence - 60_000 > ahora()) return acceso.token;
    const iat = Math.floor(ahora() / 1000);
    const cabecera = b64url({ alg: 'RS256', typ: 'JWT' });
    const cuerpo = b64url({ iss: correo, scope: ALCANCE, aud: URL_TOKEN, iat, exp: iat + 3600 });
    const firma = crypto.sign('RSA-SHA256', Buffer.from(`${cabecera}.${cuerpo}`), llave).toString('base64url');
    let r;
    try {
      r = await fetch(URL_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cabecera}.${cuerpo}.${firma}` }).toString(),
      });
    } catch (err) {
      throw new ErrorTemporalFcm(`OAuth sin red: ${err.message}`);
    }
    if (!r.ok) throw new ErrorTemporalFcm(`OAuth respondió ${r.status}`);
    const datos = await r.json();
    acceso = { token: datos.access_token, vence: ahora() + (datos.expires_in || 3600) * 1000 };
    return acceso.token;
  }

  return {
    async enviar({ token, titulo, cuerpo, datos = {} }) {
      const mensaje = {
        message: {
          token,
          notification: { title: titulo, body: cuerpo },
          // FCM exige que los valores de data sean texto.
          data: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)])),
          android: { priority: 'high', notification: { channel_id: 'pedidos', sound: 'default' } },
        },
      };
      let r;
      try {
        r = await fetch(`https://fcm.googleapis.com/v1/projects/${proyecto}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${await tokenAcceso()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(mensaje),
        });
      } catch (err) {
        if (err instanceof ErrorTemporalFcm) throw err;
        throw new ErrorTemporalFcm(`FCM sin red: ${err.message}`);
      }
      if (r.ok) return 'ENVIADA';
      const error = await r.json().catch(() => ({}));
      const estado = error.error && error.error.status;
      // Token del teléfono vencido o desinstalada la app (CU-16 A2: se renueva en el próximo inicio de sesión).
      if (r.status === 404 || estado === 'UNREGISTERED' || (r.status === 400 && estado === 'INVALID_ARGUMENT')) return 'TOKEN_INVALIDO';
      if (r.status === 401) acceso = null;
      throw new ErrorTemporalFcm(`FCM respondió ${r.status} ${estado || ''}`.trim());
    },
  };
}

/** Lee la cuenta de servicio de FCM_CREDENCIALES (ruta al JSON descargado de la consola de Firebase). */
function fcmDesdeConfig(ruta) {
  if (!ruta) return null;
  return createFcm({ cuentaServicio: JSON.parse(fs.readFileSync(ruta, 'utf8')) });
}

module.exports = { createFcm, fcmDesdeConfig, ErrorTemporalFcm };
