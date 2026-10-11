'use strict';

/**
 * Los 40 municipios de Norte de Santander (cobertura del SRS, sección Alcance).
 * La app muestra la misma lista en un selector (app/src/datos/municipios.js).
 */
const MUNICIPIOS = Object.freeze([
  'Ábrego', 'Arboledas', 'Bochalema', 'Bucarasica', 'Cáchira', 'Cácota', 'Chinácota', 'Chitagá',
  'Convención', 'Cúcuta', 'Cucutilla', 'Durania', 'El Carmen', 'El Tarra', 'El Zulia', 'Gramalote',
  'Hacarí', 'Herrán', 'La Esperanza', 'La Playa', 'Labateca', 'Los Patios', 'Lourdes', 'Mutiscua',
  'Ocaña', 'Pamplona', 'Pamplonita', 'Puerto Santander', 'Ragonvalia', 'Salazar', 'San Calixto',
  'San Cayetano', 'Santiago', 'Sardinata', 'Silos', 'Teorama', 'Tibú', 'Toledo', 'Villa Caro',
  'Villa del Rosario',
]);

/** Quita tildes y mayúsculas para comparar ("cucuta" = "Cúcuta"). */
const clave = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const PORCLAVE = new Map(MUNICIPIOS.map((m) => [clave(m), m]));

/** Devuelve el nombre oficial del municipio o null si no pertenece al departamento. */
function municipioOficial(texto) {
  if (typeof texto !== 'string') return null;
  return PORCLAVE.get(clave(texto)) || null;
}

module.exports = { MUNICIPIOS, municipioOficial };
