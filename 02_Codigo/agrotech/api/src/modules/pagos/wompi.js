'use strict';

const crypto = require('node:crypto');

/**
 * Integración con la pasarela Wompi (ADR-001). Sin SDK: solo SHA-256 del módulo crypto de Node.
 * Referencias: docs.wompi.co → Widget & Checkout Web (firma de integridad) y Eventos (checksum).
 */

const sha256 = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

/** Firma de integridad: SHA-256(referencia + monto en centavos + moneda + secreto de integridad). */
function firmaIntegridad({ referencia, montoCentavos, moneda = 'COP', secretoIntegridad }) {
  return sha256(`${referencia}${montoCentavos}${moneda}${secretoIntegridad}`);
}

/** URL del Web Checkout (redirección). La app la abre en el navegador del sistema. */
function urlCheckout({ urlBase, llavePublica, referencia, montoCentavos, moneda = 'COP', firma, urlRetorno }) {
  const params = new URLSearchParams({
    'public-key': llavePublica,
    currency: moneda,
    'amount-in-cents': String(montoCentavos),
    reference: referencia,
    'signature:integrity': firma,
  });
  if (urlRetorno) params.set('redirect-url', urlRetorno);
  return `${urlBase}?${params.toString()}`;
}

/** Lee "transaction.id" dentro de data. */
function valorEn(obj, ruta) {
  return ruta.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

/**
 * Verifica el checksum de un evento:
 * SHA-256(valores de signature.properties en orden + timestamp + secreto de eventos) = signature.checksum.
 * Comparación en tiempo constante. Devuelve false ante cualquier dato faltante.
 */
function verificarEvento(evento, secretoEventos) {
  const props = evento && evento.signature && evento.signature.properties;
  const recibido = evento && evento.signature && evento.signature.checksum;
  if (!Array.isArray(props) || !props.length || typeof recibido !== 'string' || evento.timestamp === undefined) return false;
  const valores = props.map((p) => valorEn(evento.data, p));
  if (valores.some((v) => v === undefined || v === null)) return false;
  const calculado = sha256(`${valores.join('')}${evento.timestamp}${secretoEventos}`);
  const a = Buffer.from(calculado, 'hex');
  const b = Buffer.from(recibido.toLowerCase(), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Estado de la transacción en Wompi → estado_transaccion de AgroTech. */
const ESTADOS = Object.freeze({ APPROVED: 'APROBADA', DECLINED: 'RECHAZADA', VOIDED: 'ANULADA', ERROR: 'ERROR', PENDING: 'PENDIENTE' });

module.exports = { firmaIntegridad, urlCheckout, verificarEvento, sha256, ESTADOS };
