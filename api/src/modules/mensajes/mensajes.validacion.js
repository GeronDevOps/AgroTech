'use strict';

const { errores } = require('../../utils/http-error');
const { esUuid } = require('../productos/productos.validacion');

const MAX_CARACTERES = 500;

/** CU-05 A3: mensaje vacío o que excede el límite no se envía. El id lo genera el teléfono (reenvío idempotente). */
function validarMensaje(body = {}) {
  const errs = {};
  const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : '';
  if (!esUuid(body.id)) errs.id = 'Identificador del mensaje inválido (UUID).';
  if (!contenido) errs.contenido = 'Escriba un mensaje.';
  else if (contenido.length > MAX_CARACTERES) errs.contenido = `Máximo ${MAX_CARACTERES} caracteres.`;
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise el mensaje.', { campos: errs });
  return { id: body.id.toLowerCase(), contenido };
}

module.exports = { validarMensaje, MAX_CARACTERES };
