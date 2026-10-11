/**
 * Formatos para Colombia sin depender de Intl (disponible de forma desigual en teléfonos de gama baja).
 */

/** 85000 → "$ 85.000" */
export function formatoPesos(n) {
  const entero = Math.round(Number(n) || 0);
  return `$ ${String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** 2.5 → "2,5" · 20 → "20" */
export function formatoCantidad(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [ent, dec] = String(v).split('.');
  return `${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${dec ? `,${dec}` : ''}`;
}

/** Texto escrito por el usuario → número. Acepta "85.000", "85000", "2,5". */
export function leerNumero(texto, { decimales = false } = {}) {
  const limpio = String(texto || '').replace(/[$\s]/g, '');
  if (!limpio) return Number.NaN;
  if (!decimales) return Number(limpio.replace(/\./g, ''));
  return Number(limpio.replace(/\./g, '').replace(',', '.'));
}

const dosDigitos = (n) => String(n).padStart(2, '0');

/** Fecha de la última sincronización (CU-17 paso 1): "hoy 10:42", "11/10 10:42" o "nunca". */
export function textoSincronizacion(iso, ahora = new Date()) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  const hora = `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
  const mismoDia = d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth() && d.getDate() === ahora.getDate();
  return mismoDia ? `hoy ${hora}` : `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)} ${hora}`;
}
