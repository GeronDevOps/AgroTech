/**
 * Valores del catálogo. Los códigos coinciden con la migración 002 y api/src/datos/catalogo.js.
 * Cada opción lleva ícono y texto (RNF-02: nunca solo texto ni solo ícono).
 */
export const CATEGORIAS = Object.freeze([
  { codigo: 'TUBERCULOS', nombre: 'Tubérculos', icono: '🥔' },
  { codigo: 'HORTALIZAS', nombre: 'Hortalizas', icono: '🥬' },
  { codigo: 'FRUTAS', nombre: 'Frutas', icono: '🍓' },
  { codigo: 'GRANOS', nombre: 'Granos', icono: '🌽' },
  { codigo: 'CAFE_CACAO', nombre: 'Café y cacao', icono: '☕' },
  { codigo: 'PLATANO', nombre: 'Plátano y banano', icono: '🍌' },
  { codigo: 'LACTEOS_HUEVOS', nombre: 'Lácteos y huevos', icono: '🥚' },
  { codigo: 'OTROS', nombre: 'Otros', icono: '🧺' },
]);

export const UNIDADES = Object.freeze([
  { codigo: 'kg', nombre: 'kg', singular: 'kilo', plural: 'kilos' },
  { codigo: 'libra', nombre: 'libra', singular: 'libra', plural: 'libras' },
  { codigo: 'arroba', nombre: 'arroba', singular: 'arroba', plural: 'arrobas' },
  { codigo: 'bulto', nombre: 'bulto', singular: 'bulto', plural: 'bultos' },
  { codigo: 'canastilla', nombre: 'canastilla', singular: 'canastilla', plural: 'canastillas' },
  { codigo: 'unidad', nombre: 'unidad', singular: 'unidad', plural: 'unidades' },
  { codigo: 'docena', nombre: 'docena', singular: 'docena', plural: 'docenas' },
  { codigo: 'litro', nombre: 'litro', singular: 'litro', plural: 'litros' },
]);

/** Accesos rápidos del wireframe 2 ("Papa · Cebolla · Café · Más…"): un toque llena nombre, categoría y unidad. */
export const PRODUCTOS_FRECUENTES = Object.freeze([
  { nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto' },
  { nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba' },
  { nombre: 'Café pergamino', categoria: 'CAFE_CACAO', unidad: 'kg' },
  { nombre: 'Tomate', categoria: 'HORTALIZAS', unidad: 'canastilla' },
  { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg' },
  { nombre: 'Plátano', categoria: 'PLATANO', unidad: 'kg' },
]);

export const categoria = (codigo) => CATEGORIAS.find((c) => c.codigo === codigo) || CATEGORIAS[CATEGORIAS.length - 1];
export const unidad = (codigo) => UNIDADES.find((u) => u.codigo === codigo) || UNIDADES[0];
