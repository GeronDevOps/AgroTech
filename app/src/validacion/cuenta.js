import { MUNICIPIOS } from '../datos/municipios';

/**
 * Validación en el teléfono de CU-01 y CU-21: misma política que la API
 * (api/src/modules/auth/auth.validacion.js) para marcar errores sin gastar datos móviles.
 * La API sigue siendo la autoridad: vuelve a validar todo.
 */
const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const RE_NOMBRE = new RegExp(`^[${LETRAS}][${LETRAS} '.-]*$`);
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function limpiarTelefono(v) {
  let d = String(v || '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+57')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}

export function errorContrasena(v) {
  if (!v || v.length < 8) return 'Use al menos 8 caracteres.';
  if (v.length > 72) return 'Use máximo 72 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v) || !/\d/.test(v)) return 'Incluya al menos una letra y un número.';
  return null;
}

/** Devuelve { campo: mensaje } con los errores encontrados (vacío si todo está bien). */
export function validarRegistro(d) {
  const e = {};
  for (const campo of ['nombres', 'apellidos']) {
    const t = (d[campo] || '').trim();
    if (t.length < 2 || t.length > 80 || !RE_NOMBRE.test(t)) e[campo] = 'Escriba un nombre válido (solo letras).';
  }
  if (!/^3\d{9}$/.test(limpiarTelefono(d.telefono))) e.telefono = 'Escriba un celular de 10 dígitos que empiece por 3.';
  const correo = (d.correo || '').trim();
  if (!RE_CORREO.test(correo) || correo.length > 120) e.correo = 'Escriba un correo válido.';
  if (!MUNICIPIOS.includes(d.municipio)) e.municipio = 'Elija su municipio.';
  if ((d.veredaDireccion || '').trim().length > 150) e.veredaDireccion = 'Use máximo 150 caracteres.';
  const errClave = errorContrasena(d.contrasena);
  if (errClave) e.contrasena = errClave;
  if (d.aceptaTratamientoDatos !== true) e.aceptaTratamientoDatos = 'Debe aceptar el tratamiento de datos para crear la cuenta.';
  return e;
}

export function validarInicio({ identificador, contrasena }) {
  const e = {};
  if (!(identificador || '').trim()) e.identificador = 'Escriba su correo o celular.';
  if (!contrasena) e.contrasena = 'Escriba su contraseña.';
  return e;
}

/** Texto para el usuario a partir de un ErrorApi (mensajes en lenguaje sencillo). */
export function mensajeDeError(error) {
  if (!error) return null;
  if (error.codigo === 'SIN_CONEXION') return 'Necesita señal para continuar. Sus datos siguen escritos; intente cuando tenga conexión.';
  if (error.codigo === 'CUENTA_BLOQUEADA' && error.detalles && error.detalles.bloqueadoHasta) {
    const hasta = new Date(error.detalles.bloqueadoHasta);
    const hora = `${String(hasta.getHours()).padStart(2, '0')}:${String(hasta.getMinutes()).padStart(2, '0')}`;
    return `${error.message} Podrá intentar de nuevo a las ${hora}.`;
  }
  return error.message;
}
