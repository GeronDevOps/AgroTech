'use strict';

const { errores } = require('../../utils/http-error');
const { municipioOficial } = require('../../datos/municipios');
const { validarNombre, texto, normalizarTelefono, esTelefonoValido, normalizarCorreo } = require('../auth/auth.validacion');

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Recuadro de Norte de Santander (con margen): una ubicación fuera de él es un error del GPS o del usuario. */
const LIMITES = Object.freeze({ latMin: 6.7, latMax: 9.4, lonMin: -73.8, lonMax: -71.9 });

const dentroDelDepartamento = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= LIMITES.latMin && lat <= LIMITES.latMax && lon >= LIMITES.lonMin && lon <= LIMITES.lonMax;

/**
 * CU-09 · Actualizar datos de contacto y ubicación. Todos los campos son opcionales (cambio parcial).
 * A1: el rol no se puede cambiar (lo gestiona el administrador).
 */
function validarPerfil(body = {}) {
  const errs = {};
  const c = {};
  if (body.rol !== undefined) {
    throw errores.conflicto('ROL_NO_EDITABLE', 'El rol no se puede cambiar desde el perfil. Pídalo a la asociación (administrador).');
  }
  if (body.nombres !== undefined) c.nombres = validarNombre(body.nombres, 'nombres', errs);
  if (body.apellidos !== undefined) c.apellidos = validarNombre(body.apellidos, 'apellidos', errs);
  if (body.correo !== undefined) {
    c.correo = normalizarCorreo(body.correo);
    if (!RE_CORREO.test(c.correo) || c.correo.length > 120) errs.correo = 'Escriba un correo válido.';
  }
  if (body.telefono !== undefined) {
    c.telefono = normalizarTelefono(body.telefono);
    if (!esTelefonoValido(c.telefono)) errs.telefono = 'Escriba un celular de 10 dígitos que empiece por 3.';
  }
  if (body.municipio !== undefined) {
    c.municipio = municipioOficial(body.municipio);
    if (!c.municipio) errs.municipio = 'Elija un municipio de Norte de Santander.';
  }
  if (body.veredaDireccion !== undefined) {
    c.veredaDireccion = texto(body.veredaDireccion) || null;
    if (c.veredaDireccion && c.veredaDireccion.length > 150) errs.veredaDireccion = 'Use máximo 150 caracteres.';
  }
  if (body.ubicacion !== undefined && body.ubicacion !== null) {
    const lat = Number(body.ubicacion.lat);
    const lon = Number(body.ubicacion.lon);
    if (!dentroDelDepartamento(lat, lon)) errs.ubicacion = 'La ubicación no está en Norte de Santander.';
    else c.ubicacion = { lat, lon };
  }
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise los datos marcados.', { campos: errs });
  if (!Object.keys(c).length) throw errores.datosInvalidos('No hay cambios para guardar.', { campos: { cambios: 'Modifique al menos un dato.' } });
  return c;
}

module.exports = { validarPerfil, dentroDelDepartamento, LIMITES };
