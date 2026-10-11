'use strict';

const { errores } = require('../../utils/http-error');
const { esUuid } = require('../productos/productos.validacion');

/** Validación de CU-04 (confirmar pedido) y CU-13 (cambiar estado). */

const FRANJAS = Object.freeze({ MANANA: 'Mañana', TARDE: 'Tarde' });
const METODOS = ['CONTRA_ENTREGA', 'EN_LINEA'];
const ESTADOS_PRODUCTOR = ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];
const MAX_ITEMS = 50;

const texto = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function lanzarSiHay(errs) {
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise los datos del pedido.', { campos: errs });
}

/** Idempotency-Key: UUID generado en el teléfono una vez por carrito (RNF-10). */
function validarClave(valor) {
  if (!esUuid(valor)) {
    throw errores.datosInvalidos('Falta la cabecera Idempotency-Key (UUID generado en el teléfono).', { campos: { idempotencyKey: 'UUID requerido' } });
  }
  return valor.toLowerCase();
}

function validarConfirmacion(body = {}) {
  const errs = {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > MAX_ITEMS) errs.items = `El carrito debe tener entre 1 y ${MAX_ITEMS} productos.`;

  const vistos = new Set();
  const limpios = [];
  items.forEach((it, i) => {
    const cantidad = typeof it?.cantidad === 'string' ? Number(it.cantidad) : it?.cantidad;
    const ok2dec = Number.isFinite(cantidad) && Math.round(cantidad * 100) === cantidad * 100;
    if (!esUuid(it?.idProducto)) errs[`items[${i}].idProducto`] = 'Producto inválido.';
    else if (vistos.has(it.idProducto)) errs[`items[${i}].idProducto`] = 'Producto repetido en el carrito.';
    if (!ok2dec || cantidad <= 0 || cantidad > 100000) errs[`items[${i}].cantidad`] = 'Cantidad inválida.';
    vistos.add(it?.idProducto);
    limpios.push({ idProducto: String(it?.idProducto).toLowerCase(), cantidad });
  });

  const puntoEntrega = texto(body.puntoEntrega);
  if (puntoEntrega.length < 3 || puntoEntrega.length > 150) errs.puntoEntrega = 'Indique dónde se entrega (3 a 150 caracteres).';

  const franjaEntrega = FRANJAS[String(body.franjaEntrega || '').toUpperCase().replace('Ñ', 'N')];
  if (!franjaEntrega) errs.franjaEntrega = 'Elija la franja de entrega: mañana o tarde.';

  const metodoPago = body.metodoPago === undefined ? 'CONTRA_ENTREGA' : String(body.metodoPago).toUpperCase();
  if (!METODOS.includes(metodoPago)) errs.metodoPago = 'Elija contra entrega o en línea.';

  lanzarSiHay(errs);
  return { items: limpios, puntoEntrega, franjaEntrega, metodoPago };
}

function validarCambioEstado(body = {}) {
  const errs = {};
  const estado = String(body.estado || '').toUpperCase();
  if (!ESTADOS_PRODUCTOR.includes(estado)) errs.estado = 'Estado inválido.';
  const motivo = texto(body.motivo) || null;
  if (estado === 'CANCELADO' && (!motivo || motivo.length < 3)) errs.motivo = 'Indique el motivo del rechazo.';
  if (motivo && motivo.length > 150) errs.motivo = 'Use máximo 150 caracteres.';
  let version;
  if (body.version !== undefined) {
    version = Number(body.version);
    if (!Number.isInteger(version) || version < 1) errs.version = 'Versión inválida.';
  }
  lanzarSiHay(errs);
  return { estado, motivo, version };
}

module.exports = { validarClave, validarConfirmacion, validarCambioEstado, FRANJAS };
