'use strict';

/**
 * Capa de datos de productos (tabla producto, vista v_reputacion_productor).
 * Los productos de cuentas no activas no aparecen en el catálogo.
 */
const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.id_productor, p.nombre, p.descripcion, p.categoria, p.precio, p.unidad_medida,
         p.stock, p.foto_url, p.municipio, p.estado, p.version, p.fecha_publicacion, p.actualizado_en,
         u.nombres AS productor_nombres, u.apellidos AS productor_apellidos, u.verificado AS productor_verificado,
         r.promedio AS calificacion_promedio, COALESCE(r.total_calificaciones, 0) AS calificacion_total
  FROM producto p
  JOIN usuario u ON u.id_usuario = p.id_productor
  LEFT JOIN v_reputacion_productor r ON r.id_productor = p.id_productor`;

/** WHERE parametrizado del catálogo: nunca se concatenan valores del usuario. */
function construirFiltro({ municipio, categoria, precioMin, precioMax }) {
  const cond = ["p.estado = 'ACTIVA'", 'p.stock > 0', "u.estado = 'ACTIVA'"];
  const params = [];
  const agregar = (sql, valor) => { params.push(valor); cond.push(`${sql} $${params.length}`); };
  if (municipio) agregar('p.municipio =', municipio);
  if (categoria) agregar('p.categoria =', categoria);
  if (precioMin !== undefined) agregar('p.precio >=', precioMin);
  if (precioMax !== undefined) agregar('p.precio <=', precioMax);
  return { where: cond.join(' AND '), params };
}

function createProductosRepository({ pool }) {
  // `db` permite ejecutar dentro de una transacción ajena (operaciones de la cola, /sync/push).
  async function buscarPorId(id, db = pool) {
    const { rows } = await db.query(`${SELECT_PRODUCTO} WHERE p.id_producto = $1`, [id]);
    return rows[0] || null;
  }

  return {
    buscarPorId,

    /** Inserta la publicación; si el id ya existe no hace nada (reintentos de la cola sin conexión). */
    async insertar(d) {
      const { rowCount } = await pool.query(
        `INSERT INTO producto (id_producto, id_productor, nombre, descripcion, categoria, precio, unidad_medida,
                               stock, foto_url, municipio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id_producto) DO NOTHING`,
        [d.id, d.idProductor, d.nombre, d.descripcion, d.categoria, d.precio, d.unidad, d.stock, d.fotoClave, d.municipio],
      );
      return rowCount === 1;
    },

    /**
     * RF-10a con control de concurrencia optimista: solo actualiza si la versión coincide.
     * Cantidad 0 → AGOTADA (CU-10 A3); cantidad > 0 sobre una AGOTADA → ACTIVA.
     * El disparador fn_tocar_fila incrementa version y actualizado_en.
     */
    async actualizarPrecioStock(id, idProductor, { precio, stock, version }, db = pool) {
      const { rowCount } = await db.query(
        `UPDATE producto SET
           precio = COALESCE($3::numeric, precio),
           stock  = COALESCE($4::numeric, stock),
           estado = CASE
                      WHEN COALESCE($4::numeric, stock) = 0 AND estado = 'ACTIVA' THEN 'AGOTADA'::estado_producto
                      WHEN COALESCE($4::numeric, stock) > 0 AND estado = 'AGOTADA' THEN 'ACTIVA'::estado_producto
                      ELSE estado
                    END
         WHERE id_producto = $1 AND id_productor = $2 AND version = $5`,
        [id, idProductor, precio ?? null, stock ?? null, version],
      );
      return rowCount === 1;
    },

    /** CU-03: activos con stock, filtros opcionales, del más reciente al más antiguo. */
    async catalogo(filtros) {
      const { where, params } = construirFiltro(filtros);
      const { pagina, tamano } = filtros;
      const n = params.length;
      const { rows } = await pool.query(
        `${SELECT_PRODUCTO.replace('SELECT p.id_producto', 'SELECT COUNT(*) OVER() AS total_filas, p.id_producto')}
         WHERE ${where}
         ORDER BY p.fecha_publicacion DESC, p.id_producto
         LIMIT $${n + 1} OFFSET $${n + 2}`,
        [...params, tamano, (pagina - 1) * tamano],
      );
      return { filas: rows, total: rows.length ? Number(rows[0].total_filas) : null };
    },

    /** Total del catálogo con los mismos filtros (cuando la página pedida queda vacía). */
    async contarCatalogo(filtros) {
      const { where, params } = construirFiltro(filtros);
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM producto p JOIN usuario u ON u.id_usuario = p.id_productor WHERE ${where}`,
        params,
      );
      return rows[0].n;
    },

    /** "Mis productos": todas las publicaciones vigentes del productor (no las retiradas). */
    async delProductor(idProductor) {
      const { rows } = await pool.query(
        `${SELECT_PRODUCTO} WHERE p.id_productor = $1 AND p.estado <> 'INACTIVA'
         ORDER BY p.actualizado_en DESC`,
        [idProductor],
      );
      return rows;
    },
  };
}

module.exports = { createProductosRepository, SELECT_PRODUCTO };
