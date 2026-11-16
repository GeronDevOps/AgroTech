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

/**
 * Ubicación del productor para "Cerca de mí" (CU-12 paso 3): su punto del perfil si vende en su propio
 * municipio; si no (o si no tiene punto), la cabecera del municipio de la publicación.
 */
const UBICACION_PRODUCTOR = `(CASE WHEN u.coordenadas IS NOT NULL AND u.municipio = p.municipio THEN u.coordenadas ELSE mp.ubicacion END)`;

/** Orden del catálogo (CU-11 paso 3, CU-12). Siempre termina en id para que la paginación sea estable. */
const ORDENES = Object.freeze({
  recientes: 'p.fecha_publicacion DESC, p.id_producto',
  precio_asc: 'p.precio ASC, p.fecha_publicacion DESC, p.id_producto',
  precio_desc: 'p.precio DESC, p.fecha_publicacion DESC, p.id_producto',
  calificacion: 'r.promedio DESC NULLS LAST, r.total_calificaciones DESC NULLS LAST, p.fecha_publicacion DESC, p.id_producto',
  cercania: 'distancia_m ASC NULLS LAST, p.fecha_publicacion DESC, p.id_producto',
});

/** WHERE parametrizado del catálogo: nunca se concatenan valores del usuario. */
function construirFiltro({ municipio, categoria, precioMin, precioMax, q, punto, radioKm }) {
  const cond = ["p.estado = 'ACTIVA'", 'p.stock > 0', "u.estado = 'ACTIVA'"];
  const params = [];
  const agregar = (sql, valor) => { params.push(valor); cond.push(`${sql} $${params.length}`); };
  if (municipio) agregar('p.municipio =', municipio);
  if (categoria) agregar('p.categoria =', categoria);
  if (precioMin !== undefined) agregar('p.precio >=', precioMin);
  if (precioMax !== undefined) agregar('p.precio <=', precioMax);
  // CU-11 paso 2: nombre y descripción, sin distinguir mayúsculas ni tildes (índice ix_producto_busqueda).
  if (q) {
    params.push(q);
    cond.push(`fn_texto_busqueda(p.nombre || ' ' || coalesce(p.descripcion, '')) LIKE '%' || fn_texto_busqueda($${params.length}) || '%'`);
  }
  let distancia = 'NULL::float8';
  if (punto) {
    params.push(punto.lon, punto.lat);
    const pt = `ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`;
    distancia = `ST_Distance(${UBICACION_PRODUCTOR}, ${pt})`;
    // CU-12 paso 4: radio máximo opcional.
    if (radioKm) { params.push(radioKm * 1000); cond.push(`ST_DWithin(${UBICACION_PRODUCTOR}, ${pt}, $${params.length})`); }
  }
  return { where: cond.join(' AND '), params, distancia };
}

const FROM_CATALOGO = `
  FROM producto p
  JOIN usuario u ON u.id_usuario = p.id_productor
  LEFT JOIN municipio mp ON mp.nombre = p.municipio
  LEFT JOIN v_reputacion_productor r ON r.id_productor = p.id_productor`;

function createProductosRepository({ pool }) {
  // `db` permite ejecutar dentro de una transacción ajena (operaciones de la cola, /sync/push).
  async function buscarPorId(id, db = pool) {
    const { rows } = await db.query(`${SELECT_PRODUCTO} WHERE p.id_producto = $1`, [id]);
    return rows[0] || null;
  }

  return {
    pool,
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
     * RF-10a / RF-10 con control de concurrencia optimista: solo actualiza si la versión coincide.
     * Cantidad 0 → AGOTADA (CU-10 A3); cantidad > 0 sobre una AGOTADA → ACTIVA. Una PAUSADA sigue pausada.
     * El disparador fn_tocar_fila incrementa version y actualizado_en.
     */
    async actualizarPrecioStock(id, idProductor, { precio, stock, version, nombre, descripcion }, db = pool) {
      const { rowCount } = await db.query(
        `UPDATE producto SET
           nombre = COALESCE($6::varchar, nombre),
           descripcion = CASE WHEN $7::boolean THEN $8::text ELSE descripcion END,
           precio = COALESCE($3::numeric, precio),
           stock  = COALESCE($4::numeric, stock),
           estado = CASE
                      WHEN COALESCE($4::numeric, stock) = 0 AND estado = 'ACTIVA' THEN 'AGOTADA'::estado_producto
                      WHEN COALESCE($4::numeric, stock) > 0 AND estado = 'AGOTADA' THEN 'ACTIVA'::estado_producto
                      ELSE estado
                    END
         WHERE id_producto = $1 AND id_productor = $2 AND version = $5`,
        [id, idProductor, precio ?? null, stock ?? null, version, nombre ?? null, descripcion !== undefined, descripcion ?? null],
      );
      return rowCount === 1;
    },

    /** CU-10 pasos 1-3: pausar, reactivar o retirar (borrado lógico) con la versión leída. */
    async cambiarEstado(id, idProductor, { estado, version }, db = pool) {
      const { rowCount } = await db.query(
        'UPDATE producto SET estado = $3 WHERE id_producto = $1 AND id_productor = $2 AND version = $4',
        [id, idProductor, estado, version],
      );
      return rowCount === 1;
    },

    /** CU-10 paso 2 / A1: pedidos en curso que incluyen la publicación. */
    async pedidosEnCurso(id, db = pool) {
      const { rows } = await db.query(
        `SELECT count(DISTINCT d.id_pedido)::int AS n FROM detalle_pedido d JOIN pedido pe ON pe.id_pedido = d.id_pedido
         WHERE d.id_producto = $1 AND pe.estado IN ('PENDIENTE', 'ACEPTADO', 'EN_CAMINO')`,
        [id],
      );
      return rows[0].n;
    },

    /** CU-11 A1: categorías con más publicaciones activas, para sugerir cuando no hay coincidencias. */
    async categoriasFrecuentes(limite = 4) {
      const { rows } = await pool.query(
        `SELECT p.categoria, count(*)::int AS n FROM producto p JOIN usuario u ON u.id_usuario = p.id_productor
         WHERE p.estado = 'ACTIVA' AND p.stock > 0 AND u.estado = 'ACTIVA'
         GROUP BY p.categoria ORDER BY n DESC, p.categoria LIMIT $1`,
        [limite],
      );
      return rows;
    },

    /** CU-12 paso 2 / A1: ubicación guardada en el perfil o, si no hay, la cabecera de su municipio. */
    async ubicacionDelUsuario(idUsuario) {
      const { rows } = await pool.query(
        `SELECT ST_Y(coalesce(u.coordenadas, m.ubicacion)::geometry) AS lat, ST_X(coalesce(u.coordenadas, m.ubicacion)::geometry) AS lon,
                u.municipio, (u.coordenadas IS NOT NULL) AS propia
         FROM usuario u LEFT JOIN municipio m ON m.nombre = u.municipio WHERE u.id_usuario = $1`,
        [idUsuario],
      );
      const f = rows[0];
      return f && f.lat !== null ? { lat: Number(f.lat), lon: Number(f.lon), municipio: f.municipio } : null;
    },

    /**
     * CU-03 / CU-11 / CU-12: activos con stock, filtros y búsqueda opcionales, en el orden pedido
     * (por defecto del más reciente al más antiguo). Con `punto` calcula la distancia al productor.
     */
    async catalogo(filtros) {
      const { where, params, distancia } = construirFiltro(filtros);
      const { pagina, tamano } = filtros;
      const n = params.length;
      const orden = ORDENES[filtros.orden] || ORDENES.recientes;
      const select = SELECT_PRODUCTO
        .replace('SELECT p.id_producto', `SELECT COUNT(*) OVER() AS total_filas, ${distancia} AS distancia_m, p.id_producto`)
        .replace(/\s+FROM producto p[\s\S]*$/, FROM_CATALOGO);
      const { rows } = await pool.query(
        `${select}
         WHERE ${where}
         ORDER BY ${orden}
         LIMIT $${n + 1} OFFSET $${n + 2}`,
        [...params, tamano, (pagina - 1) * tamano],
      );
      return { filas: rows, total: rows.length ? Number(rows[0].total_filas) : null };
    },

    /** Total del catálogo con los mismos filtros (cuando la página pedida queda vacía). */
    async contarCatalogo(filtros) {
      const { where, params } = construirFiltro(filtros);
      const { rows } = await pool.query(`SELECT count(*)::int AS n ${FROM_CATALOGO} WHERE ${where}`, params);
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

module.exports = { createProductosRepository, SELECT_PRODUCTO, ORDENES };
