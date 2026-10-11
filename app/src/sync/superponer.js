/**
 * Superpone a los datos del servidor los cambios que siguen en la cola del teléfono (CU-17 paso 2):
 * el productor ve lo que hizo sin señal, marcado como "Pendiente por sincronizar" o "Con error".
 */
const estadoSync = (op) => ({ estado: op.estado, error: op.error, idOperacion: op.id, tipo: op.tipo });

/** Publicación provisional armada con lo que está en la cola (aún no existe en el servidor). */
export function productoProvisional(op, usuario) {
  const d = op.payload;
  return {
    id: d.id,
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    categoria: d.categoria,
    unidad: d.unidad,
    precio: d.precio,
    stock: d.stock,
    municipio: d.municipio,
    estado: 'ACTIVA',
    version: 0,
    fotoUrl: op.archivos && op.archivos.foto,
    miniaturaUrl: op.archivos && op.archivos.miniatura,
    fechaPublicacion: op.creadoEn,
    actualizadoEn: op.creadoEn,
    productor: { id: usuario.id, nombre: `${usuario.nombres} ${(usuario.apellidos || ' ').charAt(0)}.`, verificado: !!usuario.verificado, calificacion: { promedio: null, total: 0 } },
    sync: { ...estadoSync(op), nueva: true },
  };
}

/** Aplica la última edición en cola de una publicación (precio y cantidad que el productor ve). */
export function conCola(producto, ops) {
  if (!producto) return producto;
  const edicion = [...ops].reverse().find((o) => o.idEntidad === producto.id && o.tipo === 'EDITAR');
  if (!edicion) return producto;
  if (edicion.estado === 'CON_ERROR') return { ...producto, sync: estadoSync(edicion) }; // prevalece el servidor
  const { precio, stock } = edicion.payload;
  const nuevoStock = stock !== undefined ? stock : producto.stock;
  let { estado } = producto;
  if (nuevoStock === 0 && estado === 'ACTIVA') estado = 'AGOTADA';
  if (nuevoStock > 0 && estado === 'AGOTADA') estado = 'ACTIVA';
  return { ...producto, precio: precio !== undefined ? precio : producto.precio, stock: nuevoStock, estado, sync: estadoSync(edicion) };
}

/** "Mis productos": primero lo que aún no llega al servidor, luego lo publicado con sus ediciones en cola. */
export function misProductosConCola(productos, ops, usuario) {
  const ids = new Set(productos.map((p) => p.id));
  const nuevas = ops
    .filter((o) => o.entidad === 'PRODUCTO' && o.tipo === 'CREAR' && !ids.has(o.idEntidad))
    .reverse()
    .map((o) => productoProvisional(o, usuario));
  return [...nuevas, ...productos.map((p) => conCola(p, ops))];
}
