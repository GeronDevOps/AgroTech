import { leerNumero } from '../utilidades/formato';

/**
 * Validación en el teléfono de CU-02 y RF-10a (misma política que api/src/modules/productos/productos.validacion.js).
 */
const PRECIO_MIN = 50;
const PRECIO_MAX = 50000000;
const STOCK_MAX = 100000;

export function errorPrecio(texto) {
  const n = leerNumero(texto);
  if (!Number.isInteger(n) || n < PRECIO_MIN || n > PRECIO_MAX) return 'Escriba el precio en pesos, sin centavos (mínimo $ 50).';
  return null;
}

export function errorCantidad(texto, { permitirCero }) {
  const n = leerNumero(texto, { decimales: true });
  const ok = Number.isFinite(n) && Math.round(n * 100) === n * 100 && n >= 0 && n <= STOCK_MAX && (permitirCero || n > 0);
  if (!ok) return permitirCero ? 'Escriba una cantidad de 0 o más.' : 'Escriba una cantidad mayor que 0.';
  return null;
}

/** Devuelve { campo: mensaje }. */
export function validarPublicacion(f) {
  const e = {};
  if (!f.fotos) e.foto = 'Tome o elija una foto del producto.';
  const nombre = (f.nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 80) e.nombre = 'Escriba qué producto vende.';
  if (!f.categoria) e.categoria = 'Elija una categoría.';
  if (!f.unidad) e.unidad = 'Elija cómo lo vende.';
  const errCant = errorCantidad(f.cantidad, { permitirCero: false });
  if (errCant) e.stock = errCant;
  const errPrecio = errorPrecio(f.precio);
  if (errPrecio) e.precio = errPrecio;
  if ((f.descripcion || '').length > 500) e.descripcion = 'Use máximo 500 caracteres.';
  if (!f.municipio) e.municipio = 'Elija el municipio.';
  return e;
}
