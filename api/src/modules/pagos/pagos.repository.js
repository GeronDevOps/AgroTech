'use strict';

/** Capa de datos de pagos (tabla pago, migración 003) y su efecto en pedido.estado_pago. */
function createPagosRepository() {
  return {
    async bloquearPedido(db, id) {
      const { rows } = await db.query('SELECT * FROM pedido WHERE id_pedido = $1 FOR UPDATE', [id]);
      return rows[0] || null;
    },

    /** Intento vigente (pendiente o aprobado): el índice ux_pago_vigente garantiza a lo sumo uno. */
    async pagoVigente(db, idPedido) {
      const { rows } = await db.query(
        "SELECT * FROM pago WHERE id_pedido = $1 AND estado IN ('PENDIENTE', 'APROBADA')",
        [idPedido],
      );
      return rows[0] || null;
    },

    async insertarPago(db, { idPedido, referencia, montoCentavos }) {
      const { rows } = await db.query(
        'INSERT INTO pago (id_pedido, referencia, monto_centavos) VALUES ($1, $2, $3) RETURNING *',
        [idPedido, referencia, montoCentavos],
      );
      return rows[0];
    },

    async bloquearPagoPorReferencia(db, referencia) {
      const { rows } = await db.query('SELECT * FROM pago WHERE referencia = $1 FOR UPDATE', [referencia]);
      return rows[0] || null;
    },

    async actualizarPago(db, idPago, { estado, idTransaccion, medio, evento }) {
      await db.query(
        'UPDATE pago SET estado = $2, id_transaccion = COALESCE($3, id_transaccion), medio = COALESCE($4, medio), evento = $5 WHERE id_pago = $1',
        [idPago, estado, idTransaccion, medio, evento],
      );
    },

    async actualizarPedidoPago(db, idPedido, { metodoPago, estadoPago }) {
      await db.query(
        'UPDATE pedido SET metodo_pago = COALESCE($2, metodo_pago), estado_pago = $3 WHERE id_pedido = $1',
        [idPedido, metodoPago || null, estadoPago],
      );
    },

    async bitacora(db, { accion, idEntidad, resultado }) {
      await db.query(
        "INSERT INTO bitacora (id_usuario, accion, entidad, id_entidad, resultado) VALUES (NULL, $1, 'PAGO', $2, $3)",
        [accion, idEntidad, resultado],
      );
    },
  };
}

module.exports = { createPagosRepository };
