'use strict';

const { errores } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { esUuid } = require('../productos/productos.validacion');

const MAX_COMENTARIO = 300;
const TAMANO = 20;
const nombreCorto = (n, a) => `${n} ${a.charAt(0)}.`;

function validarCalificacion(body = {}) {
  const errs = {};
  const puntuacion = typeof body.puntuacion === 'string' ? Number(body.puntuacion) : body.puntuacion;
  const comentario = typeof body.comentario === 'string' ? body.comentario.trim().replace(/\s+/g, ' ') : '';
  if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) errs.puntuacion = 'Elija de 1 a 5 estrellas.';
  if (comentario.length > MAX_COMENTARIO) errs.comentario = `Máximo ${MAX_COMENTARIO} caracteres.`;
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise la calificación.', { campos: errs });
  return { puntuacion, comentario: comentario || null };
}

/**
 * CU-06 · Calificar al productor (RF-06). Solo el consumidor del pedido, solo entregado (A1), una vez (A2).
 * El promedio se recalcula desde la vista v_reputacion_productor (no se guarda duplicado).
 */
function createCalificacionesService({ pool, calificacionesRepository: repo, eventos }) {
  const emitir = (evento, datos) => { if (eventos) eventos.emit(evento, datos); };

  async function calificarEn(db, { usuario, idPedido, c }) {
    const p = esUuid(idPedido) ? await repo.pedido(db, idPedido) : null;
    if (!p || p.id_consumidor !== usuario.id) throw errores.noEncontrado('El pedido no existe.');
    if (p.estado !== 'ENTREGADO') throw errores.conflicto('PEDIDO_NO_ENTREGADO', 'Podrá calificar cuando el pedido esté entregado.');
    const nueva = await repo.insertar(db, { idPedido: p.id_pedido, ...c });
    if (!nueva) {
      throw errores.conflicto('YA_CALIFICADO', 'Este pedido ya fue calificado.', { calificacion: await repo.dePedido(db, p.id_pedido) });
    }
    const reputacion = await repo.reputacion(db, p.id_productor);
    return { p, calificacion: nueva, reputacion };
  }

  return {
    /** `db` y `diferir`: desde /sync/push (CU-06 A3, calificación guardada sin señal). */
    async calificar({ usuario, idPedido, body, db, diferir = false }) {
      const c = validarCalificacion(body);
      const r = db ? await calificarEn(db, { usuario, idPedido, c }) : await transaccion(pool, (tx) => calificarEn(tx, { usuario, idPedido, c }));
      const avisar = () => emitir('calificacion_nueva', { idPedido: r.p.id_pedido, idProductor: r.p.id_productor, reputacion: r.reputacion });
      const respuesta = { calificacion: r.calificacion, reputacion: r.reputacion };
      if (diferir) return { ...respuesta, alConfirmar: avisar };
      avisar();
      return respuesta;
    },

    /** CU-06 paso 4: opiniones visibles en el perfil del productor (consumidor con nombre corto, RNF-05). */
    async delProductor({ idProductor, query = {} }) {
      const prod = esUuid(idProductor) ? await repo.productor(idProductor) : null;
      if (!prod) throw errores.noEncontrado('El productor no existe.');
      const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1);
      const filas = await repo.delProductor(idProductor, { limite: TAMANO + 1, desplazamiento: (pagina - 1) * TAMANO });
      return {
        productor: { id: prod.id_usuario, nombre: nombreCorto(prod.nombres, prod.apellidos), municipio: prod.municipio, verificado: prod.verificado },
        reputacion: await repo.reputacion(pool, idProductor),
        // CU-18: un comentario ocultado por el administrador conserva la puntuación pero no el texto.
        calificaciones: filas.slice(0, TAMANO).map((f) => ({
          id: f.id_calificacion, puntuacion: f.puntuacion, comentario: f.comentario, oculto: f.oculta, fecha: f.fecha, consumidor: nombreCorto(f.nombres, f.apellidos),
        })),
        pagina,
        hayMas: filas.length > TAMANO,
      };
    },
  };
}

module.exports = { createCalificacionesService, validarCalificacion };
