'use strict';

const { errores } = require('../../utils/http-error');
const { esUuid } = require('../productos/productos.validacion');

const MAX_OPERACIONES = 50;
const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/**
 * Lote de POST /sync/push. Solo invalida el lote completo lo que impide responder por operación
 * (lote mal formado o id_operacion inválido); el resto se valida por operación.
 */
function validarLote(body) {
  const ops = body && body.operaciones;
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > MAX_OPERACIONES) {
    throw errores.datosInvalidos(`Envíe entre 1 y ${MAX_OPERACIONES} operaciones.`);
  }
  const vistos = new Set();
  return ops.map((op, i) => {
    if (!esObjeto(op) || !esUuid(op.idOperacion)) {
      throw errores.datosInvalidos(`La operación ${i + 1} no tiene un idOperacion válido (UUID).`);
    }
    if (vistos.has(op.idOperacion)) throw errores.datosInvalidos(`La operación ${op.idOperacion} está repetida en el lote.`);
    vistos.add(op.idOperacion);
    const creadoEn = typeof op.creadoEn === 'string' && !Number.isNaN(Date.parse(op.creadoEn)) ? new Date(op.creadoEn) : null;
    return {
      idOperacion: op.idOperacion,
      tipo: typeof op.tipo === 'string' ? op.tipo.trim().toUpperCase() : '',
      idEntidad: esUuid(op.idEntidad) ? op.idEntidad : null,
      datos: esObjeto(op.datos) ? op.datos : null,
      creadoEn,
    };
  });
}

/** Parámetros de GET /sync/pull: `desde` (ISO 8601) y cursor opcional `despuesDe` (id del último producto). */
function validarPull(query) {
  const q = query || {};
  let desde = null;
  if (q.desde !== undefined && q.desde !== '') {
    if (typeof q.desde !== 'string' || Number.isNaN(Date.parse(q.desde))) throw errores.datosInvalidos('El parámetro "desde" debe ser una fecha ISO 8601.');
    desde = q.desde; // se conserva el texto: el cursor lleva microsegundos que Date perdería
  }
  let despuesDe = null;
  if (q.despuesDe !== undefined && q.despuesDe !== '') {
    if (!esUuid(q.despuesDe) || !desde) throw errores.datosInvalidos('"despuesDe" debe ser un UUID y requiere "desde".');
    despuesDe = q.despuesDe;
  }
  return { desde, despuesDe };
}

module.exports = { validarLote, validarPull, MAX_OPERACIONES };
