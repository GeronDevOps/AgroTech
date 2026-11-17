'use strict';

const { SELECT_PRODUCTO } = require('../productos/productos.repository');
const { SELECT_PEDIDO } = require('../pedidos/pedidos.repository');

/** Un producto ajeno es visible en la copia local si está publicado (activo o agotado) y su cuenta está activa. */
/** Marca exacta del cursor (microsegundos, UTC): un Date de JavaScript solo guarda milisegundos. */
const CURSOR_TS = `to_char(p.actualizado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const VISIBLE = "(p.estado IN ('ACTIVA', 'AGOTADA') AND u.estado = 'ACTIVA')";

/** Capa de datos de la sincronización (operacion_sync y consultas de cambios). */
function createSyncRepository({ pool }) {
  return {
    /** Serializa los reenvíos simultáneos de una misma operación. */
    bloquearOperacion: (db, id) => db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 727303))', [id]),

    async buscarOperacion(db, id) {
      const { rows } = await db.query('SELECT id_usuario, resultado, respuesta FROM operacion_sync WHERE id_operacion = $1', [id]);
      return rows[0] || null;
    },

    registrarOperacion: (db, o) => db.query(
      `INSERT INTO operacion_sync (id_operacion, id_usuario, tipo, id_entidad, resultado, respuesta, creado_en_app)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [o.idOperacion, o.idUsuario, o.tipo.slice(0, 40), o.idEntidad, o.resultado, JSON.stringify(o.respuesta), o.creadoEn],
    ),

    async ahora() {
      const { rows } = await pool.query('SELECT now() AS ahora');
      return rows[0].ahora;
    },

    /**
     * Productos que la copia local debe tener, cambiados después del cursor (actualizado_en, id).
     * Incluye los propios del productor (salvo retirados) y los ajenos visibles.
     */
    async productosCambiados({ idUsuario, desde, despuesDe, limite }) {
      const params = [idUsuario, limite];
      let cursor = '';
      if (desde && despuesDe) {
        params.push(desde, despuesDe);
        cursor = 'AND (p.actualizado_en, p.id_producto) > ($3::timestamptz, $4)';
      } else if (desde) {
        params.push(desde);
        cursor = 'AND p.actualizado_en > $3';
      }
      const { rows } = await pool.query(
        `${SELECT_PRODUCTO.replace('SELECT p.id_producto', `SELECT ${CURSOR_TS} AS cursor_ts, p.id_producto`)}
         WHERE ((p.id_productor = $1 AND p.estado <> 'INACTIVA') OR ${VISIBLE}) ${cursor}
         ORDER BY p.actualizado_en, p.id_producto
         LIMIT $2`,
        params,
      );
      return rows;
    },

    /** Ids que ya no deben estar en la copia local (pausados, retirados o de cuentas suspendidas). */
    async productosRetirados({ idUsuario, desde }) {
      const { rows } = await pool.query(
        `SELECT p.id_producto FROM producto p JOIN usuario u ON u.id_usuario = p.id_productor
         WHERE p.actualizado_en > $2
           AND NOT ((p.id_productor = $1 AND p.estado <> 'INACTIVA') OR ${VISIBLE})`,
        [idUsuario, desde],
      );
      return rows.map((r) => r.id_producto);
    },

    /** Pedidos del usuario (como consumidor o productor): todos los cambiados desde `desde`, o los últimos 100. */
    async pedidosCambiados({ idUsuario, desde }) {
      const { rows } = desde
        ? await pool.query(
          `${SELECT_PEDIDO} WHERE (p.id_consumidor = $1 OR p.id_productor = $1) AND p.actualizado_en > $2 ORDER BY p.actualizado_en`,
          [idUsuario, desde],
        )
        : await pool.query(
          `${SELECT_PEDIDO} WHERE (p.id_consumidor = $1 OR p.id_productor = $1) ORDER BY p.fecha DESC LIMIT 100`,
          [idUsuario],
        );
      return rows;
    },

    async depurar(dias) {
      const { rowCount } = await pool.query('DELETE FROM operacion_sync WHERE procesado_en < now() - make_interval(days => $1)', [dias]);
      return rowCount;
    },
  };
}

module.exports = { createSyncRepository };
