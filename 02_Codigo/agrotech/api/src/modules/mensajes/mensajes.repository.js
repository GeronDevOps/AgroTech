'use strict';

const { ACTIVOS } = require('../pedidos/pedidos.repository');

const COLUMNAS = 'id_mensaje, id_pedido, id_emisor, contenido, fecha, leido, leido_en';

/** Capa de datos del chat por pedido (tabla mensaje). */
function createMensajesRepository({ pool }) {
  return {
    async pedido(db, idPedido) {
      const { rows } = await db.query('SELECT id_pedido, id_consumidor, id_productor, estado FROM pedido WHERE id_pedido = $1', [idPedido]);
      return rows[0] || null;
    },

    async buscar(db, id) {
      const { rows } = await db.query(`SELECT ${COLUMNAS} FROM mensaje WHERE id_mensaje = $1`, [id]);
      return rows[0] || null;
    },

    /** Inserta con el id generado en el teléfono; si ya existe no hace nada (reenvío). */
    async insertar(db, { id, idPedido, idEmisor, contenido }) {
      const { rows } = await db.query(
        `INSERT INTO mensaje (id_mensaje, id_pedido, id_emisor, contenido) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_mensaje) DO NOTHING RETURNING ${COLUMNAS}`,
        [id, idPedido, idEmisor, contenido],
      );
      return rows[0] || null;
    },

    /** Historial en orden cronológico; `despuesDe` (ISO) trae solo lo nuevo. */
    async delPedido(idPedido, { despuesDe, limite }) {
      const params = [idPedido, limite];
      let filtro = '';
      // La app solo conoce milisegundos: se compara truncado para no repetir el último mensaje.
      if (despuesDe) { params.push(despuesDe); filtro = "AND date_trunc('milliseconds', fecha) > $3::timestamptz"; }
      const { rows } = await pool.query(
        `SELECT * FROM (SELECT ${COLUMNAS} FROM mensaje WHERE id_pedido = $1 ${filtro} ORDER BY fecha DESC LIMIT $2) t ORDER BY fecha`,
        params,
      );
      return rows;
    },

    /** CU-05 paso 4: marca leídos los mensajes de la contraparte. */
    async marcarLeidos(idPedido, idLector) {
      const { rows } = await pool.query(
        `UPDATE mensaje SET leido = true, leido_en = now()
         WHERE id_pedido = $1 AND id_emisor <> $2 AND NOT leido RETURNING id_mensaje, leido_en`,
        [idPedido, idLector],
      );
      return rows;
    },

    /** Conversaciones del usuario: pedidos con mensajes o activos, de la actividad más reciente a la más antigua. */
    async conversaciones(idUsuario) {
      const { rows } = await pool.query(
        `SELECT p.id_pedido, p.estado, p.fecha, p.id_consumidor, p.id_productor, p.total,
                uc.nombres AS c_nombres, uc.apellidos AS c_apellidos, up.nombres AS p_nombres, up.apellidos AS p_apellidos,
                m.contenido AS ult_contenido, m.fecha AS ult_fecha, m.id_emisor AS ult_emisor,
                (SELECT count(*) FROM mensaje x WHERE x.id_pedido = p.id_pedido AND x.id_emisor <> $1 AND NOT x.leido)::int AS sin_leer
         FROM pedido p
         JOIN usuario uc ON uc.id_usuario = p.id_consumidor
         JOIN usuario up ON up.id_usuario = p.id_productor
         LEFT JOIN LATERAL (SELECT contenido, fecha, id_emisor FROM mensaje WHERE id_pedido = p.id_pedido ORDER BY fecha DESC LIMIT 1) m ON true
         WHERE (p.id_consumidor = $1 OR p.id_productor = $1) AND (m.fecha IS NOT NULL OR p.estado IN ${ACTIVOS})
         ORDER BY COALESCE(m.fecha, p.fecha) DESC
         LIMIT 50`,
        [idUsuario],
      );
      return rows;
    },
  };
}

module.exports = { createMensajesRepository };
