/**
 * Los 40 municipios de Norte de Santander. Debe coincidir con api/src/datos/municipios.js.
 */
export const MUNICIPIOS = Object.freeze([
  'Ábrego',
  'Arboledas',
  'Bochalema',
  'Bucarasica',
  'Cáchira',
  'Cácota',
  'Chinácota',
  'Chitagá',
  'Convención',
  'Cúcuta',
  'Cucutilla',
  'Durania',
  'El Carmen',
  'El Tarra',
  'El Zulia',
  'Gramalote',
  'Hacarí',
  'Herrán',
  'La Esperanza',
  'La Playa',
  'Labateca',
  'Los Patios',
  'Lourdes',
  'Mutiscua',
  'Ocaña',
  'Pamplona',
  'Pamplonita',
  'Puerto Santander',
  'Ragonvalia',
  'Salazar',
  'San Calixto',
  'San Cayetano',
  'Santiago',
  'Sardinata',
  'Silos',
  'Teorama',
  'Tibú',
  'Toledo',
  'Villa Caro',
  'Villa del Rosario',
]);

/** Quita tildes y mayúsculas para buscar ("cucuta" encuentra "Cúcuta"). Sin Intl: funciona en cualquier motor JS. */
const SIN_TILDE = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };
export const sinTildes = (t) => t.toLowerCase().replace(/[áéíóúüñ]/g, (c) => SIN_TILDE[c]).trim();
