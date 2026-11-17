'use strict';

const { errores } = require('../../utils/http-error');
const { municipioOficial } = require('../../datos/municipios');
const { CATEGORIAS, UNIDADES } = require('../../datos/catalogo');

/**
 * Validación de CU-02 (publicar), CU-10 / RF-10a (editar precio y cantidad) y CU-03 (filtros).
 * Errores: 400 DATOS_INVALIDOS con { campos: { campo: mensaje } }.
 */

const ORDENES_CATALOGO = ['recientes', 'precio_asc', 'precio_desc', 'calificacion', 'cercania'];
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRECIO_MIN = 50;
const PRECIO_MAX = 50_000_000;
const STOCK_MAX = 100_000;

const esUuid = (v) => typeof v === 'string' && RE_UUID.test(v);
const texto = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function lanzarSiHay(errs) {
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise los datos marcados.', { campos: errs });
}

function numero(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return Number.NaN;
}

/** Precio en pesos colombianos enteros (sin centavos). */
function validarPrecio(v, errs) {
  const n = numero(v);
  if (!Number.isInteger(n) || n < PRECIO_MIN || n > PRECIO_MAX) {
    errs.precio = `Escriba un precio en pesos entre $${PRECIO_MIN} y $${PRECIO_MAX.toLocaleString('es-CO')}.`;
  }
  return n;
}

/** Cantidad con hasta 2 decimales (p. ej. 2,5 kg). */
function validarStock(v, errs, { permitirCero }) {
  const n = numero(v);
  const decimalesOk = Number.isFinite(n) && Math.round(n * 100) === n * 100;
  if (!decimalesOk || n < 0 || n > STOCK_MAX || (!permitirCero && n === 0)) {
    errs.stock = permitirCero ? 'Escriba una cantidad de 0 o más.' : 'Escriba una cantidad mayor que 0.';
  }
  return n;
}

function validarPublicacion(datos = {}) {
  const errs = {};
  if (datos.id !== undefined && !esUuid(datos.id)) errs.id = 'Identificador inválido.';

  const nombre = texto(datos.nombre);
  if (nombre.length < 2 || nombre.length > 80) errs.nombre = 'Escriba el nombre del producto (2 a 80 caracteres).';

  const descripcion = texto(datos.descripcion) || null;
  if (descripcion && descripcion.length > 500) errs.descripcion = 'Use máximo 500 caracteres.';

  const categoria = typeof datos.categoria === 'string' ? datos.categoria.toUpperCase() : '';
  if (!CATEGORIAS.includes(categoria)) errs.categoria = 'Elija una categoría.';

  const unidad = typeof datos.unidad === 'string' ? datos.unidad.toLowerCase() : '';
  if (!UNIDADES.includes(unidad)) errs.unidad = 'Elija la unidad de venta.';

  const precio = validarPrecio(datos.precio, errs);
  const stock = validarStock(datos.stock, errs, { permitirCero: false });

  const municipio = municipioOficial(datos.municipio);
  if (!municipio) errs.municipio = 'Elija un municipio de Norte de Santander.';

  lanzarSiHay(errs);
  return { id: datos.id, nombre, descripcion, categoria, unidad, precio, stock, municipio };
}

const esJpeg = (buf) => Buffer.isBuffer(buf) && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

/** CU-02 A2: sin foto no se publica. Se exige JPEG comprimido y su miniatura. */
function validarFotos({ foto, miniatura }, { maxBytes, maxBytesMiniatura }) {
  const errs = {};
  if (!foto || !esJpeg(foto.buffer)) errs.foto = 'Tome o elija una foto del producto (JPEG).';
  else if (foto.buffer.length > maxBytes) errs.foto = `La foto pesa más de ${Math.round(maxBytes / 1024)} KB.`;
  if (!miniatura || !esJpeg(miniatura.buffer)) errs.miniatura = 'Falta la miniatura de la foto (JPEG).';
  else if (miniatura.buffer.length > maxBytesMiniatura) errs.miniatura = `La miniatura pesa más de ${Math.round(maxBytesMiniatura / 1024)} KB.`;
  lanzarSiHay(errs);
}

/** RF-10a / RF-10: precio, cantidad, nombre y/o descripción, con la versión leída para detectar conflictos. */
function validarEdicion(body = {}) {
  const errs = {};
  const version = numero(body.version);
  if (!Number.isInteger(version) || version < 1) errs.version = 'Falta la versión de la publicación.';
  const cambios = {};
  if (body.precio !== undefined) cambios.precio = validarPrecio(body.precio, errs);
  if (body.stock !== undefined) cambios.stock = validarStock(body.stock, errs, { permitirCero: true }); // A3: 0 → Agotada
  if (body.nombre !== undefined) {
    cambios.nombre = texto(body.nombre);
    if (cambios.nombre.length < 2 || cambios.nombre.length > 80) errs.nombre = 'Escriba el nombre del producto (2 a 80 caracteres).';
  }
  if (body.descripcion !== undefined) {
    cambios.descripcion = texto(body.descripcion) || null;
    if (cambios.descripcion && cambios.descripcion.length > 500) errs.descripcion = 'Use máximo 500 caracteres.';
  }
  if (!['precio', 'stock', 'nombre', 'descripcion'].some((k) => body[k] !== undefined)) {
    errs.cambios = 'Indique el nuevo precio, la nueva cantidad, el nombre o la descripción.';
  }
  lanzarSiHay(errs);
  return { version, ...cambios };
}

/** CU-10: pausar (oculta), reactivar (vuelve al catálogo) o retirar (inactiva y conserva el histórico). */
const ACCIONES_ESTADO = Object.freeze({ PAUSAR: 'PAUSADA', REACTIVAR: 'ACTIVA', RETIRAR: 'INACTIVA' });
function validarCambioEstadoProducto(body = {}) {
  const errs = {};
  const accion = typeof body.accion === 'string' ? body.accion.toUpperCase() : '';
  if (!ACCIONES_ESTADO[accion]) errs.accion = 'Elija pausar, reactivar o retirar.';
  const version = numero(body.version);
  if (!Number.isInteger(version) || version < 1) errs.version = 'Falta la versión de la publicación.';
  lanzarSiHay(errs);
  return { accion, version };
}

/** CU-03 paso 2: filtros por municipio, categoría y rango de precio, con paginación. */
function validarFiltros(q = {}) {
  const errs = {};
  const f = {};
  if (q.municipio) {
    f.municipio = municipioOficial(q.municipio);
    if (!f.municipio) errs.municipio = 'Municipio desconocido.';
  }
  if (q.categoria) {
    f.categoria = String(q.categoria).toUpperCase();
    if (!CATEGORIAS.includes(f.categoria)) errs.categoria = 'Categoría desconocida.';
  }
  for (const campo of ['precioMin', 'precioMax']) {
    if (q[campo] !== undefined && q[campo] !== '') {
      const n = numero(q[campo]);
      if (!Number.isFinite(n) || n < 0) errs[campo] = 'Debe ser un número positivo.';
      else f[campo] = n;
    }
  }
  if (f.precioMin !== undefined && f.precioMax !== undefined && f.precioMin > f.precioMax) {
    errs.precioMax = 'El precio máximo debe ser mayor que el mínimo.';
  }
  // CU-11: búsqueda por texto (mínimo 3 caracteres). Se quitan los comodines de LIKE.
  if (q.q !== undefined && q.q !== '') {
    f.q = texto(String(q.q)).replace(/[%_\\]/g, '');
    if (f.q.length < 3) errs.q = 'Escriba al menos 3 letras para buscar.';
    else if (f.q.length > 60) errs.q = 'Use máximo 60 caracteres.';
  }
  f.orden = q.orden === undefined || q.orden === '' ? 'recientes' : String(q.orden).toLowerCase();
  if (!ORDENES_CATALOGO.includes(f.orden)) errs.orden = `Orden inválido (${ORDENES_CATALOGO.join(', ')}).`;
  // CU-12: ubicación del teléfono (opcional) y radio máximo.
  if (q.lat !== undefined || q.lon !== undefined) {
    const lat = numero(q.lat);
    const lon = numero(q.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) errs.ubicacion = 'Ubicación inválida.';
    else f.punto = { lat, lon };
  }
  if (q.radioKm !== undefined && q.radioKm !== '') {
    f.radioKm = numero(q.radioKm);
    if (!Number.isFinite(f.radioKm) || f.radioKm < 1 || f.radioKm > 300) errs.radioKm = 'El radio va de 1 a 300 km.';
  }
  f.pagina = q.pagina === undefined ? 1 : numero(q.pagina);
  if (!Number.isInteger(f.pagina) || f.pagina < 1) errs.pagina = 'Página inválida.';
  f.tamano = q.tamano === undefined ? 20 : numero(q.tamano);
  if (!Number.isInteger(f.tamano) || f.tamano < 1 || f.tamano > 50) errs.tamano = 'El tamaño de página va de 1 a 50.';
  lanzarSiHay(errs);
  return f;
}

module.exports = {
  validarPublicacion, validarFotos, validarEdicion, validarFiltros, validarCambioEstadoProducto, esUuid, esJpeg, ACCIONES_ESTADO, ORDENES_CATALOGO,
};
