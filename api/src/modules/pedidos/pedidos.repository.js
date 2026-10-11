'use strict';

/**
 * Capa de datos de pedidos (pedido, detalle_pedido, historial_estado, producto).
 * Las funciones que reciben `db` se ejecutan dentro de la transacción del servicio.
 */

const SELECT_PEDIDO = `
  SELECT p.id_pedido, p.id_consumidor, p.id_productor, p.clave_idempotencia, p.fecha, p.estado, p.total,
         p.punto_entrega, p.franja_entrega, p.motivo_cancelacion, p.metodo_pago, p.estado_pago, p.version, p.actualizado_en,
         uc.nombres AS c_nombres, uc.apellidos AS c_apellidos,
         up.nombres AS p_nombres, up.apellidos AS p_apellidos, up.municipio AS p_municipio,
         cal.puntuacion AS cal_puntuacion, cal.comentario AS cal_comentario, cal.fecha AS cal_fecha,
         COALESCE((SELECT json_agg(json_build_object(
                     'idProducto', d.id_producto, 'nombre', pr.nombre, 'unidad', pr.unidad_medida,
                     'cantidad', d.cantidad, 'precioUnitario', d.precio_unitario, 'subtotal', d.subtotal) ORDER BY pr.nombre)
                   FROM detalle_pedido d JOIN producto pr ON pr.id_producto = d.id_producto
                   WHERE d.id_pedido = p.id_pedido), '[]'::json) AS items
  FROM pedido p
  JOIN usuario uc ON uc.id_usuario = p.id_consumidor
  JOIN usuario up ON up.id_usuario = p.id_productor
  LEFT JOIN calificacion cal ON cal.id_pedido = p.id_pedido`;

const ACTIVOS = "('PENDIENTE', 'ACEPTADO', 'EN_CAMINO')";

function createPedidosRepository({ pool }) {
  return {
    /** Serializa las peticiones con la misma clave (reintentos simultáneos desde el teléfono). */
    bloquearClave: (db, clave) => db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 727302))', [clave]),

    async pedidosPorClave(db, clave) {
      const { rows } = await db.query(`${SELECT_PEDIDO} WHERE p.clave_idempotencia = $1 ORDER BY up.nombres`, [clave]);
      return rows;
    },

    /** CU-04 paso 3: bloqueo en orden fijo (por id) para evitar interbloqueos entre carritos. */
    async bloquearProductos(db, ids) {
      const { rows } = await db.query(
        `SELECT pr.id_producto, pr.id_productor, pr.nombre, pr.precio, pr.stock, pr.estado, pr.unidad_medida,
                u.estado AS estado_productor
         FROM producto pr JOIN usuario u ON u.id_usuario = pr.id_productor
         WHERE pr.id_producto = ANY($1::uuid[])
         ORDER BY pr.id_producto
         FOR UPDATE OF pr`,
        [ids],
      );
      return rows;
    },

    async insertarPedido(db, p) {
      const { rows } = await db.query(
        `INSERT INTO pedido (id_consumidor, id_productor, clave_idempotencia, total, punto_entrega, franja_entrega, metodo_pago, estado_pago)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_pedido`,
        [p.idConsumidor, p.idProductor, p.clave, p.total, p.puntoEntrega, p.franjaEntrega, p.metodoPago,
          p.metodoPago === 'EN_LINEA' ? 'PENDIENTE' : 'NO_APLICA'],
      );
      return rows[0].id_pedido;
    },

    async insertarDetalle(db, idPedido, { idProducto, cantidad, precio }) {
      await db.query(
        'INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
        [idPedido, idProducto, cantidad, precio],
      );
    },

    async registrarHistorial(db, { idPedido, idUsuario = null, anterior = null, nuevo }) {
      await db.query(
        'INSERT INTO historial_estado (id_pedido, id_usuario, estado_anterior, estado_nuevo) VALUES ($1, $2, $3, $4)',
        [idPedido, idUsuario, anterior, nuevo],
      );
    },

    /** Descuenta (cantidad > 0) o restituye (cantidad < 0) el stock; ajusta ACTIVA ↔ AGOTADA. */
    async moverStock(db, idProducto, delta) {
      await db.query(
        `UPDATE producto SET
           stock  = stock - $2::numeric,
           estado = CASE WHEN stock - $2::numeric = 0 AND estado = 'ACTIVA' THEN 'AGOTADA'::estado_producto
                         WHEN stock - $2::numeric > 0 AND estado = 'AGOTADA' THEN 'ACTIVA'::estado_producto
                         ELSE estado END
         WHERE id_producto = $1`,
        [idProducto, delta],
      );
    },

    async buscarPorId(db, id) {
      const { rows } = await (db || pool).query(`${SELECT_PEDIDO} WHERE p.id_pedido = $1`, [id]);
      return rows[0] || null;
    },

    async bloquearPedido(db, id) {
      const { rows } = await db.query('SELECT * FROM pedido WHERE id_pedido = $1 FOR UPDATE', [id]);
      return rows[0] || null;
    },

    async actualizarEstado(db, id, { estado, motivo }) {
      await db.query(
        'UPDATE pedido SET estado = $2, motivo_cancelacion = COALESCE($3, motivo_cancelacion) WHERE id_pedido = $1',
        [id, estado, motivo],
      );
    },

    async detalleDe(db, id) {
      const { rows } = await db.query('SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = $1 ORDER BY id_producto', [id]);
      return rows;
    },

    async historial(id) {
      const { rows } = await pool.query(
        `SELECT estado_anterior, estado_nuevo, fecha FROM historial_estado WHERE id_pedido = $1 ORDER BY fecha, id_historial`,
        [id],
      );
      return rows;
    },

    async ultimoPago(id) {
      const { rows } = await pool.query(
        'SELECT estado, medio, referencia, creado_en FROM pago WHERE id_pedido = $1 ORDER BY creado_en DESC LIMIT 1',
        [id],
      );
      return rows[0] || null;
    },

    /** CU-15 / CU-13: pedidos del usuario según su rol; activos o los últimos 50. */
    async delUsuario({ idUsuario, rol, soloActivos }) {
      const campo = rol === 'PRODUCTOR' ? 'p.id_productor' : 'p.id_consumidor';
      const { rows } = await pool.query(
        `${SELECT_PEDIDO} WHERE ${campo} = $1 ${soloActivos ? `AND p.estado IN ${ACTIVOS}` : ''}
         ORDER BY p.fecha DESC LIMIT 50`,
        [idUsuario],
      );
      return rows;
    },

    /** Mensajes sin leer de la contraparte, por pedido (CU-05 paso 4). */
    async sinLeer(ids, idUsuario) {
      if (!ids.length) return {};
      const { rows } = await pool.query(
        `SELECT id_pedido, count(*)::int AS n FROM mensaje
         WHERE id_pedido = ANY($1::uuid[]) AND id_emisor <> $2 AND NOT leido GROUP BY id_pedido`,
        [ids, idUsuario],
      );
      return Object.fromEntries(rows.map((r) => [r.id_pedido, r.n]));
    },

    /** CU-13 A3: pedidos "Pendiente" sin respuesta después de `horas`. */
    async pendientesVencidos(db, horas) {
      const { rows } = await db.query(
        `SELECT id_pedido FROM pedido WHERE estado = 'PENDIENTE' AND fecha < now() - make_interval(hours => $1)
         ORDER BY fecha FOR UPDATE SKIP LOCKED`,
        [horas],
      );
      return rows.map((r) => r.id_pedido);
    },
  };
}

module.exports = { createPedidosRepository, ACTIVOS, SELECT_PEDIDO };
