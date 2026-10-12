'use strict';

/**
 * Valores del catálogo (migración 002). La app muestra nombres e íconos (app/src/datos/catalogo.js).
 */
const CATEGORIAS = Object.freeze([
  'TUBERCULOS', 'HORTALIZAS', 'FRUTAS', 'GRANOS', 'CAFE_CACAO', 'PLATANO', 'LACTEOS_HUEVOS', 'OTROS',
]);

const UNIDADES = Object.freeze(['kg', 'libra', 'arroba', 'bulto', 'canastilla', 'unidad', 'docena', 'litro']);

module.exports = { CATEGORIAS, UNIDADES };
