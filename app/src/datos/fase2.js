/**
 * Listas de la Fase 2 del SRS: motivos de reporte (CU-19), motivos de cancelación (CU-14),
 * órdenes del catálogo (CU-11, CU-12) y periodos del historial de pedidos (CU-15).
 * Los códigos coinciden con la API (reportes.service.js, productos.validacion.js).
 */
export const MOTIVOS_REPORTE = Object.freeze([
  { valor: 'PUBLICACION_ENGANOSA', texto: 'Publicación engañosa', para: ['PRODUCTO'] },
  { valor: 'PRECIO_ABUSIVO', texto: 'Precio abusivo', para: ['PRODUCTO'] },
  { valor: 'CONTENIDO_OFENSIVO', texto: 'Contenido ofensivo', para: ['PRODUCTO', 'CALIFICACION', 'PEDIDO'] },
  { valor: 'INCUMPLIMIENTO_ENTREGA', texto: 'Incumplimiento de la entrega', para: ['PEDIDO'] },
  { valor: 'FRAUDE', texto: 'Posible fraude', para: ['PRODUCTO', 'PEDIDO'] },
  { valor: 'OTRO', texto: 'Otro', para: ['PRODUCTO', 'CALIFICACION', 'PEDIDO'] },
]);

export const MOTIVOS_CANCELACION = Object.freeze({
  CONSUMIDOR: ['Ya no lo necesito', 'Me equivoqué en el pedido', 'El productor no responde', 'Encontré otra opción'],
  PRODUCTOR: ['No tengo el producto', 'No puedo entregar en esa fecha', 'No llego al punto de entrega', 'El consumidor no responde'],
});

export const ORDENES = Object.freeze([
  { valor: 'recientes', texto: 'Más recientes', icono: '🕑' },
  { valor: 'precio_asc', texto: 'Precio: menor a mayor', icono: '⬆' },
  { valor: 'precio_desc', texto: 'Precio: mayor a menor', icono: '⬇' },
  { valor: 'calificacion', texto: 'Mejor calificados', icono: '★' },
  { valor: 'cercania', texto: 'Cerca de mí', icono: '📍' },
]);

export const RADIOS = Object.freeze([
  { valor: null, texto: 'Sin límite' },
  { valor: 10, texto: 'Hasta 10 km' },
  { valor: 25, texto: 'Hasta 25 km' },
  { valor: 50, texto: 'Hasta 50 km' },
  { valor: 100, texto: 'Hasta 100 km' },
]);

export const PERIODOS = Object.freeze([
  { valor: null, texto: 'Cualquier fecha' },
  { valor: 7, texto: 'Últimos 7 días' },
  { valor: 30, texto: 'Últimos 30 días' },
  { valor: 90, texto: 'Últimos 3 meses' },
]);

/** Fecha AAAA-MM-DD de hace `dias` días (hora local del teléfono). */
export function haceDias(dias, hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
