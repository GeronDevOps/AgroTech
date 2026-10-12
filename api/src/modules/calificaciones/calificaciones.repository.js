'use strict';

/** Capa de datos de las calificaciones (tabla calificacion y vista v_reputacion_productor). */
function createCalificacionesRepository({ pool }) {
  return {
    async pedido(db, idPedido) {
      const { rows } = await db.query('SELECT id_pedido, id_consumidor, id_productor, estado FROM pedido WHERE id_pedido = $1 FOR UPDATE', [idPedido]);
      return rows[0] || null;
    },

    async dePedido(db, idPedido) {
      const { rows } = await db.query('SELECT puntuacion, comentario, fecha FROM calificacion WHERE id_pedido = $1', [idPedido]);
      return rows[0] || null;
    },

    async insertar(db, { idPedido, puntuacion, comentario }) {
      const { rows } = await db.query(
        `INSERT INTO calificacion (id_pedido, puntuacion, comentario) VALUES ($1, $2, $3)
         ON CONFLICT (id_pedido) DO NOTHING RETURNING puntuacion, comentario, fecha`,
        [idPedido, puntuacion, comentario],
      );
      return rows[0] || null;
    },

    async reputacion(db, idProductor) {
      const { rows } = await db.query(
        `SELECT ROUND(AVG(c.puntuacion)::numeric, 2) AS promedio, COUNT(*)::int AS total
         FROM calificacion c JOIN pedido p ON p.id_pedido = c.id_pedido WHERE p.id_productor = $1`,
        [idProductor],
      );
      return { promedio: rows[0].promedio === null ? null : Number(rows[0].promedio), total: rows[0].total };
    },

    async productor(idProductor) {
      const { rows } = await pool.query(
        "SELECT id_usuario, nombres, apellidos, municipio, verificado FROM usuario WHERE id_usuario = $1 AND rol = 'PRODUCTOR' AND estado = 'ACTIVA'",
        [idProductor],
      );
      return rows[0] || null;
    },

    /** Opiniones del productor, de la más reciente a la más antigua. */
    async delProductor(idProductor, { limite, desplazamiento }) {
      const { rows } = await pool.query(
        `SELECT c.puntuacion, c.comentario, c.fecha, u.nombres, u.apellidos
         FROM calificacion c JOIN pedido p ON p.id_pedido = c.id_pedido JOIN usuario u ON u.id_usuario = p.id_consumidor
         WHERE p.id_productor = $1 ORDER BY c.fecha DESC LIMIT $2 OFFSET $3`,
        [idProductor, limite, desplazamiento],
      );
      return rows;
    },
  };
}

module.exports = { createCalificacionesRepository };
