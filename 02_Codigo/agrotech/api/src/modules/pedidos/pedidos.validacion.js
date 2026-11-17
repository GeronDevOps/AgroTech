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

/** CU-14 paso 2: motivo obligatorio (el de la lista o uno escrito). */
function validarCancelacion(body = {}) {
  const motivo = texto(body.motivo);
  const errs = {};
  if (motivo.length < 3) errs.motivo = 'Elija o escriba el motivo de la cancelación.';
  if (motivo.length > 150) errs.motivo = 'Use máximo 150 caracteres.';
  let version;
  if (body.version !== undefined) {
    version = Number(body.version);
    if (!Number.isInteger(version) || version < 1) errs.version = 'Versión inválida.';
  }
  lanzarSiHay(errs);
  return { motivo, version };
}

const ESTADOS = ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];
const GRUPOS = { activos: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO'], finalizados: ['ENTREGADO', 'CANCELADO'], todos: null };
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** CU-15 paso 2: ?estado=activos|finalizados|todos|<ESTADO>[,<ESTADO>] &desde=AAAA-MM-DD &hasta=AAAA-MM-DD &pagina */
function validarFiltrosPedidos(q = {}) {
  const errs = {};
  const bruto = String(q.estado || 'activos').trim();
  let estados;
  if (Object.prototype.hasOwnProperty.call(GRUPOS, bruto.toLowerCase())) estados = GRUPOS[bruto.toLowerCase()];
  else {
    estados = bruto.toUpperCase().split(',').map((e) => e.trim()).filter(Boolean);
    if (!estados.length || estados.some((e) => !ESTADOS.includes(e))) errs.estado = 'Estado inválido.';
  }
  const fecha = (campo) => {
    if (q[campo] === undefined || q[campo] === '') return null;
    const v = String(q[campo]);
    if (!RE_FECHA.test(v) || Number.isNaN(Date.parse(v))) { errs[campo] = 'Use el formato AAAA-MM-DD.'; return null; }
    return v;
  };
  const desde = fecha('desde');
  const hasta = fecha('hasta');
  if (desde && hasta && desde > hasta) errs.hasta = 'La fecha final debe ser posterior a la inicial.';
  const pagina = q.pagina === undefined ? 1 : Number(q.pagina);
  if (!Number.isInteger(pagina) || pagina < 1) errs.pagina = 'Página inválida.';
  lanzarSiHay(errs);
  return { estados, desde, hasta, pagina };
}

module.exports = { validarClave, validarConfirmacion, validarCambioEstado, validarCancelacion, validarFiltrosPedidos, FRANJAS };
