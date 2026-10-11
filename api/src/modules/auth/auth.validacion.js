'use strict';

const { errores } = require('../../utils/http-error');
const { municipioOficial } = require('../../datos/municipios');

/**
 * Validación y normalización de entradas de CU-01 y CU-21.
 * Si hay errores lanza 400 DATOS_INVALIDOS con { campos: { campo: mensaje } } para que
 * la app marque cada campo (CU-01 A2).
 */

const RE_NOMBRE = /^\p{L}[\p{L} '.-]*$/u;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES_REGISTRABLES = ['PRODUCTOR', 'CONSUMIDOR']; // ADMINISTRADOR solo se crea por el equipo (Fase 2)

const texto = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function normalizarCorreo(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/** Celular colombiano: 10 dígitos que empiezan por 3. Acepta espacios, guiones y prefijo +57. */
function normalizarTelefono(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  let d = String(v).replace(/[\s\-().]/g, '');
  if (d.startsWith('+57')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}

const esTelefonoValido = (t) => /^3\d{9}$/.test(t);

/** Política de contraseñas: 8 a 72 bytes (límite de Bcrypt), con al menos una letra y un número. */
function errorContrasena(v) {
  if (typeof v !== 'string' || v.length < 8) return 'Use al menos 8 caracteres.';
  if (Buffer.byteLength(v, 'utf8') > 72) return 'Use máximo 72 caracteres.';
  if (!/\p{L}/u.test(v) || !/\d/.test(v)) return 'Incluya al menos una letra y un número.';
  return null;
}

function validarNombre(v, campo, errs) {
  const t = texto(v);
  if (t.length < 2 || t.length > 80 || !RE_NOMBRE.test(t)) {
    errs[campo] = 'Escriba un nombre válido (solo letras).';
  }
  return t;
}

function validarRegistro(body = {}) {
  const errs = {};
  const nombres = validarNombre(body.nombres, 'nombres', errs);
  const apellidos = validarNombre(body.apellidos, 'apellidos', errs);

  const correo = normalizarCorreo(body.correo);
  if (!RE_CORREO.test(correo) || correo.length > 120) errs.correo = 'Escriba un correo válido.';

  const telefono = normalizarTelefono(body.telefono);
  if (!esTelefonoValido(telefono)) errs.telefono = 'Escriba un celular de 10 dígitos que empiece por 3.';

  const errClave = errorContrasena(body.contrasena);
  if (errClave) errs.contrasena = errClave;

  const rol = typeof body.rol === 'string' ? body.rol.toUpperCase() : '';
  if (!ROLES_REGISTRABLES.includes(rol)) errs.rol = 'Elija si va a vender (productor) o comprar (consumidor).';

  const municipio = municipioOficial(body.municipio);
  if (!municipio) errs.municipio = 'Elija un municipio de Norte de Santander.';

  const veredaDireccion = texto(body.veredaDireccion) || null;
  if (veredaDireccion && veredaDireccion.length > 150) errs.veredaDireccion = 'Use máximo 150 caracteres.';

  // CU-01 A3: sin autorización no se crea la cuenta (Ley 1581 de 2012).
  if (body.aceptaTratamientoDatos !== true) {
    errs.aceptaTratamientoDatos = 'Debe aceptar el tratamiento de datos para crear la cuenta.';
  }

  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise los datos marcados.', { campos: errs });
  return { nombres, apellidos, correo, telefono, contrasena: body.contrasena, rol, municipio, veredaDireccion };
}

/** CU-21: el identificador puede ser correo o celular. */
function validarSesion(body = {}) {
  const errs = {};
  const bruto = typeof body.identificador === 'string' ? body.identificador.trim() : '';
  if (!bruto) errs.identificador = 'Escriba su correo o celular.';
  if (typeof body.contrasena !== 'string' || !body.contrasena) errs.contrasena = 'Escriba su contraseña.';
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise los datos marcados.', { campos: errs });

  const identificador = bruto.includes('@')
    ? { tipo: 'correo', valor: normalizarCorreo(bruto) }
    : { tipo: 'telefono', valor: normalizarTelefono(bruto) };
  return { identificador, contrasena: body.contrasena };
}

module.exports = { validarRegistro, validarSesion, normalizarTelefono, errorContrasena };
