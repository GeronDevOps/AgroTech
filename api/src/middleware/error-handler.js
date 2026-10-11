'use strict';

const { HttpError, errores } = require('../utils/http-error');

/**
 * Traduce errores de PostgreSQL a errores HTTP con significado de negocio.
 * Las restricciones de la migración 001 son la última barrera de integridad.
 */
const PG = {
  '23505': (e) => errores.conflicto('DUPLICADO', 'El registro ya existe.', { restriccion: e.constraint }),
  '23503': (e) => errores.datosInvalidos('Referencia a un registro inexistente.', { restriccion: e.constraint }),
  '23514': (e) => errores.conflicto('RESTRICCION_INCUMPLIDA', 'La operación incumple una regla de los datos.', { restriccion: e.constraint }),
  '22P02': () => errores.datosInvalidos('Formato de dato inválido.'),
  P0001: (e) => errores.conflicto('TRANSICION_NO_PERMITIDA', e.message), // disparador de estados del pedido
};

function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.type === 'entity.parse.failed') return errores.datosInvalidos('El cuerpo de la petición no es un JSON válido.');
  if (err && err.type === 'entity.too.large') return new HttpError(413, 'DEMASIADO_GRANDE', 'La petición supera el tamaño permitido.');
  if (err && err.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE'
      ? new HttpError(413, 'FOTO_MUY_GRANDE', 'La foto supera el tamaño permitido (300 KB).')
      : errores.datosInvalidos('El envío de la foto no es válido.', { motivo: err.code });
  }
  if (err && typeof err.code === 'string' && PG[err.code]) return PG[err.code](err);
  return null;
}

function notFound(req, res, next) {
  next(errores.noEncontrado(`No existe la ruta ${req.method} ${req.originalUrl}.`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const httpErr = toHttpError(err);
  if (!httpErr) {
    console.error('[api] error no controlado:', err);
    return res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' } });
  }
  const body = { codigo: httpErr.codigo, mensaje: httpErr.message };
  if (httpErr.detalles !== undefined) body.detalles = httpErr.detalles;
  return res.status(httpErr.status).json({ error: body });
}

module.exports = { notFound, errorHandler, toHttpError };
