'use strict';

const { errores } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { registrarBitacora } = require('../../utils/bitacora');
const { esUuid } = require('../productos/productos.validacion');

const TIPOS = ['PRODUCTO', 'CALIFICACION', 'PEDIDO'];
/** Motivos de la lista (CU-19 paso 2). Deben coincidir con ck_reporte_motivo (migración 006) y la app. */
const MOTIVOS = Object.freeze({
  PUBLICACION_ENGANOSA: 'Publicación engañosa',
  PRECIO_ABUSIVO: 'Precio abusivo',
  CONTENIDO_OFENSIVO: 'Contenido ofensivo',
  INCUMPLIMIENTO_ENTREGA: 'Incumplimiento de la entrega',
  FRAUDE: 'Posible fraude',
  OTRO: 'Otro',
});

function validarReporte(body = {}) {
  const errs = {};
  const tipoContenido = String(body.tipoContenido || '').toUpperCase();
  if (!TIPOS.includes(tipoContenido)) errs.tipoContenido = 'Indique qué reporta: una publicación, un comentario o un pedido.';
  if (!esUuid(body.idContenido)) errs.idContenido = 'Contenido inválido.';
  const motivo = String(body.motivo || '').toUpperCase();
  if (!MOTIVOS[motivo]) errs.motivo = 'Elija un motivo.';
  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim().replace(/\s+/g, ' ') : '';
  if (descripcion.length > 500) errs.descripcion = 'Use máximo 500 caracteres.';
  // A2: con "Otro" la descripción es obligatoria.
  if (motivo === 'OTRO' && descripcion.length < 10) errs.descripcion = 'Con el motivo «Otro» cuéntenos qué pasó (mínimo 10 caracteres).';
  if (body.id !== undefined && !esUuid(body.id)) errs.id = 'Identificador inválido.';
  if (Object.keys(errs).length) throw errores.datosInvalidos('Revise el reporte.', { campos: errs });
  return { id: body.id, tipoContenido, idContenido: body.idContenido.toLowerCase(), motivo, descripcion: descripcion || null };
}

const reportePublico = (r) => ({
  id: r.id_reporte,
  tipoContenido: r.tipo_contenido,
  idContenido: r.id_contenido,
  motivo: r.motivo,
  motivoTexto: MOTIVOS[r.motivo],
  descripcion: r.descripcion,
  estado: r.estado,
  decision: r.decision,
  resolucion: r.resolucion,
  fecha: r.fecha,
  fechaResolucion: r.fecha_resolucion,
});

/**
 * CU-19 · Reportar contenido o incumplimiento (RF-19).
 * Paso 3: verifica que el contenido exista y que no haya un reporte igual del mismo usuario (A1: 409 REPORTE_EN_TRAMITE).
 * A3 (sin señal): la app lo encola como REPORTE.CREAR y lo envía al reconectar (idempotente por id).
 */
function createReportesService({ pool }) {
  /** Dueño del contenido reportado; también valida que el reportante pueda verlo. */
  async function reportado(db, usuario, { tipoContenido, idContenido }) {
    if (tipoContenido === 'PRODUCTO') {
      const { rows: [p] } = await db.query("SELECT id_productor FROM producto WHERE id_producto = $1 AND estado <> 'INACTIVA'", [idContenido]);
      if (!p) throw errores.noEncontrado('La publicación no existe.');
      return p.id_productor;
    }
    if (tipoContenido === 'CALIFICACION') {
      const { rows: [c] } = await db.query(
        'SELECT p.id_consumidor FROM calificacion c JOIN pedido p ON p.id_pedido = c.id_pedido WHERE c.id_calificacion = $1', [idContenido],
      );
      if (!c) throw errores.noEncontrado('El comentario no existe.');
      return c.id_consumidor;
    }
    const { rows: [p] } = await db.query('SELECT id_consumidor, id_productor FROM pedido WHERE id_pedido = $1', [idContenido]);
    if (!p || (p.id_consumidor !== usuario.id && p.id_productor !== usuario.id)) throw errores.noEncontrado('El pedido no existe.');
    return p.id_consumidor === usuario.id ? p.id_productor : p.id_consumidor;
  }

  async function crearEn(db, usuario, d) {
    const idReportado = await reportado(db, usuario, d);
    if (idReportado === usuario.id) throw errores.conflicto('REPORTE_PROPIO', 'No puede reportar su propio contenido.');
    if (d.id) {
      const { rows: [previo] } = await db.query('SELECT * FROM reporte WHERE id_reporte = $1', [d.id]);
      if (previo) {
        if (previo.id_reportante !== usuario.id) throw errores.conflicto('ID_EN_USO', 'El identificador del reporte ya fue usado.');
        return { creado: false, fila: previo };
      }
    }
    const { rows } = await db.query(
      `INSERT INTO reporte (id_reporte, id_reportante, id_reportado, tipo_contenido, id_contenido, motivo, descripcion)
       VALUES (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
       ON CONFLICT ON CONSTRAINT uq_reporte_unico DO NOTHING RETURNING *`,
      [d.id || null, usuario.id, idReportado, d.tipoContenido, d.idContenido, d.motivo, d.descripcion],
    );
    if (!rows[0]) {
      const { rows: [existente] } = await db.query(
        'SELECT * FROM reporte WHERE id_reportante = $1 AND tipo_contenido = $2 AND id_contenido = $3', [usuario.id, d.tipoContenido, d.idContenido],
      );
      throw errores.conflicto('REPORTE_EN_TRAMITE', existente && ['PENDIENTE', 'EN_REVISION'].includes(existente.estado)
        ? 'Ya reportó este contenido: el caso está en trámite.'
        : 'Ya reportó este contenido y el caso fue resuelto.', { reporte: existente ? reportePublico(existente) : null });
    }
    await registrarBitacora(db, { idUsuario: usuario.id, accion: 'REPORTE_CREADO', entidad: 'REPORTE', idEntidad: rows[0].id_reporte, resultado: d.tipoContenido });
    return { creado: true, fila: rows[0] };
  }

  return {
    MOTIVOS,
    /** `db`: desde /sync/push (reporte guardado sin señal). */
    async crear({ usuario, body, db }) {
      const d = validarReporte(body);
      const r = db ? await crearEn(db, usuario, d) : await transaccion(pool, (tx) => crearEn(tx, usuario, d));
      return { creado: r.creado, reporte: reportePublico(r.fila) };
    },

    /** CU-19 paso 4: el reportante ve el estado y el resultado de sus reportes. */
    async mios({ usuario }) {
      const { rows } = await pool.query('SELECT * FROM reporte WHERE id_reportante = $1 ORDER BY fecha DESC LIMIT 50', [usuario.id]);
      return { reportes: rows.map(reportePublico), motivos: MOTIVOS };
    },
  };
}

module.exports = { createReportesService, reportePublico, validarReporte, MOTIVOS };
