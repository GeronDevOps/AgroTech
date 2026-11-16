import { baseLocal, enTransaccion } from './baseLocal';

/**
 * Copia local de productos y pedidos (CU-17 paso 2: consultar sin red).
 * Siempre guarda lo que dijo el servidor; los cambios del usuario que aún están en la cola
 * se superponen al mostrar (ver sync/superponer.js), así "prevalece el servidor" sin perder la intención.
 */
const ACTIVOS = "('PENDIENTE', 'ACEPTADO', 'EN_CAMINO')";

async function upsertProducto(db, p, { soloSiFalta = false } = {}) {
  await db.runAsync(
    `INSERT OR ${soloSiFalta ? 'IGNORE' : 'REPLACE'} INTO cache_producto
       (id_producto, id_productor, estado, municipio, categoria, precio, stock, fecha_publicacion, datos, version, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.id, p.productor.id, p.estado, p.municipio, p.categoria, p.precio, p.stock,
    String(p.fechaPublicacion), JSON.stringify(p), p.version, String(p.actualizadoEn),
  );
}

async function upsertPedido(db, p) {
  // El detalle trae historial y pago; una lista no. No se pierde lo que ya estaba guardado.
  const previo = await db.getFirstAsync('SELECT datos FROM cache_pedido WHERE id_pedido = ?', p.id);
  const anterior = previo ? JSON.parse(previo.datos) : {};
  const datos = { ...anterior, ...p };
  if (anterior.historial && !p.historial && anterior.version !== p.version) delete datos.historial;
  await db.runAsync(
    'INSERT OR REPLACE INTO cache_pedido (id_pedido, estado, fecha, datos, version, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)',
    p.id, p.estado, String(p.fecha), JSON.stringify(datos), p.version, String(p.actualizadoEn),
  );
}

const leer = (filas) => filas.map((f) => JSON.parse(f.datos));

/** Guarda productos recibidos del servidor (catálogo, detalle, "Mis productos" o pull). */
export async function guardarProductos(productos) {
  if (!productos || !productos.length) return;
  await enTransaccion(async (tx) => { for (const p of productos) await upsertProducto(tx, p); });
}

export async function guardarPedidos(pedidos) {
  if (!pedidos || !pedidos.length) return;
  await enTransaccion(async (tx) => { for (const p of pedidos) await upsertPedido(tx, p); });
}

/**
 * Aplica una página de GET /sync/pull en una sola transacción.
 * `completa`: primera sincronización; reemplaza la copia (se conservan los productos del carrito).
 */
export async function aplicarPull({ productos = [], retirados = [], pedidos, completa }, { primeraPagina }) {
  await enTransaccion(async (tx) => {
    if (completa && primeraPagina) {
      await tx.runAsync('DELETE FROM cache_producto WHERE id_producto NOT IN (SELECT id_producto FROM carrito_local)');
      if (pedidos) await tx.runAsync('DELETE FROM cache_pedido');
    }
    for (const p of productos) await upsertProducto(tx, p);
    for (const id of retirados) {
      // Lo retirado sale del catálogo; si está en el carrito queda marcado como no disponible.
      await tx.runAsync(
        "UPDATE cache_producto SET estado = 'RETIRADA', datos = json_set(datos, '$.estado', 'RETIRADA') WHERE id_producto = ?",
        id,
      );
      await tx.runAsync('DELETE FROM cache_producto WHERE id_producto = ? AND id_producto NOT IN (SELECT id_producto FROM carrito_local)', id);
    }
    for (const p of pedidos || []) await upsertPedido(tx, p);
  });
}

/** CU-03 sin red: mismos filtros y orden que la API, sobre la copia local. */
const sinTildesMin = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Orden local equivalente al del servidor (CU-11 paso 3). "cercania" no está disponible sin señal (CU-12 A3). */
const ORDEN_LOCAL = {
  recientes: (a, b) => String(b.fechaPublicacion).localeCompare(String(a.fechaPublicacion)),
  precio_asc: (a, b) => a.precio - b.precio,
  precio_desc: (a, b) => b.precio - a.precio,
  calificacion: (a, b) => ((b.productor.calificacion.promedio || 0) - (a.productor.calificacion.promedio || 0)),
};

/**
 * CU-03 A2 / CU-11 A2: catálogo desde la copia del teléfono con los mismos filtros, búsqueda y orden.
 * La búsqueda ignora mayúsculas y tildes como en el servidor.
 */
export async function catalogoLocal({ municipio, categoria, precioMin, precioMax, q, orden = 'recientes', pagina = 1, tamano = 20 }) {
  const cond = ["estado = 'ACTIVA'", 'stock > 0'];
  const params = [];
  if (municipio) { cond.push('municipio = ?'); params.push(municipio); }
  if (categoria) { cond.push('categoria = ?'); params.push(categoria); }
  if (precioMin !== null && precioMin !== undefined) { cond.push('precio >= ?'); params.push(precioMin); }
  if (precioMax !== null && precioMax !== undefined) { cond.push('precio <= ?'); params.push(precioMax); }
  const where = cond.join(' AND ');
  const db = await baseLocal();
  if (!q && (!orden || orden === 'recientes')) {
    const total = (await db.getFirstAsync(`SELECT count(*) AS n FROM cache_producto WHERE ${where}`, ...params)).n;
    const filas = await db.getAllAsync(
      `SELECT datos FROM cache_producto WHERE ${where} ORDER BY fecha_publicacion DESC, id_producto LIMIT ? OFFSET ?`,
      ...params, tamano, (pagina - 1) * tamano,
    );
    return { productos: leer(filas), pagina, tamano, total, hayMas: pagina * tamano < total };
  }
  let todos = leer(await db.getAllAsync(`SELECT datos FROM cache_producto WHERE ${where}`, ...params));
  if (q) {
    const buscado = sinTildesMin(q);
    todos = todos.filter((p) => sinTildesMin(`${p.nombre} ${p.descripcion || ''}`).includes(buscado));
  }
  todos.sort(ORDEN_LOCAL[orden] || ORDEN_LOCAL.recientes);
  const productos = todos.slice((pagina - 1) * tamano, pagina * tamano);
  return { productos, pagina, tamano, total: todos.length, hayMas: pagina * tamano < todos.length };
}

export async function productoLocal(id) {
  const db = await baseLocal();
  const f = await db.getFirstAsync('SELECT datos FROM cache_producto WHERE id_producto = ?', id);
  return f ? JSON.parse(f.datos) : null;
}

export async function misProductosLocal(idProductor) {
  const db = await baseLocal();
  return leer(await db.getAllAsync(
    "SELECT datos FROM cache_producto WHERE id_productor = ? AND estado NOT IN ('INACTIVA', 'RETIRADA') ORDER BY actualizado_en DESC",
    idProductor,
  ));
}

/** CU-15 / CU-13 sin red. */
/** CU-15 A2: pedidos guardados en el teléfono. `grupo`: activos | finalizados | todos (RF-15); `desde`: AAAA-MM-DD. */
export async function pedidosLocal({ soloActivos = true, grupo, desde } = {}) {
  const g = grupo || (soloActivos ? 'activos' : 'todos');
  const cond = [];
  if (g === 'activos') cond.push(`estado IN ${ACTIVOS}`);
  if (g === 'finalizados') cond.push(`estado NOT IN ${ACTIVOS}`);
  const params = [];
  if (desde) { cond.push('fecha >= ?'); params.push(desde); }
  const db = await baseLocal();
  return leer(await db.getAllAsync(
    `SELECT datos FROM cache_pedido ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY fecha DESC LIMIT 50`,
    ...params,
  ));
}

export async function pedidoLocal(id) {
  const db = await baseLocal();
  const f = await db.getFirstAsync('SELECT datos FROM cache_pedido WHERE id_pedido = ?', id);
  return f ? JSON.parse(f.datos) : null;
}

/** Carrito persistente: líneas con la copia local del producto. */
export async function leerCarrito() {
  const db = await baseLocal();
  const filas = await db.getAllAsync(
    `SELECT c.cantidad, p.datos FROM carrito_local c JOIN cache_producto p ON p.id_producto = c.id_producto
     ORDER BY c.agregado_en`,
  );
  return filas.map((f) => ({ producto: JSON.parse(f.datos), cantidad: f.cantidad }));
}

export async function guardarCarrito(lineas) {
  await enTransaccion(async (tx) => {
    await tx.runAsync('DELETE FROM carrito_local');
    let i = 0;
    for (const l of lineas) {
      // La copia del producto se agrega solo si falta: la del servidor puede ser más reciente que la del carrito.
      await upsertProducto(tx, l.producto, { soloSiFalta: true });
      // agregado_en conserva el orden de las líneas
      await tx.runAsync('INSERT INTO carrito_local (id_producto, cantidad, agregado_en) VALUES (?, ?, ?)', l.producto.id, l.cantidad, String(i).padStart(4, '0'));
      i += 1;
    }
  });
}

/** Chat (CU-05): guarda lo recibido del servidor para leerlo sin señal. */
export async function guardarMensajes(mensajes) {
  if (!mensajes || !mensajes.length) return;
  await enTransaccion(async (tx) => {
    for (const m of mensajes) {
      await tx.runAsync(
        'INSERT OR REPLACE INTO cache_mensaje (id_mensaje, id_pedido, fecha, datos) VALUES (?, ?, ?, ?)',
        m.id, m.idPedido, String(m.fecha), JSON.stringify(m),
      );
    }
  });
}

export async function mensajesLocal(idPedido) {
  const db = await baseLocal();
  return leer(await db.getAllAsync('SELECT datos FROM cache_mensaje WHERE id_pedido = ? ORDER BY fecha', idPedido));
}

/** Calificación aplicada desde la cola (CU-06 A3): el pedido guardado pasa a solo lectura. */
export async function guardarCalificacionLocal(idPedido, calificacion) {
  const db = await baseLocal();
  await db.runAsync("UPDATE cache_pedido SET datos = json_set(datos, '$.calificacion', json(?)) WHERE id_pedido = ?", JSON.stringify(calificacion), idPedido);
}

