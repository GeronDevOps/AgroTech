/**
 * Tema visual de AgroTech (RNF-02 · Entrega 3, sección 7).
 * Alto contraste, textos grandes y áreas táctiles de al menos 48 dp.
 */
export const colores = {
  primario: '#2E7D32', // verde oscuro: contraste 5,1:1 sobre blanco
  primarioClaro: '#E8F5E9',
  texto: '#1B1B1B',
  textoSecundario: '#555555',
  fondo: '#FFFFFF',
  superficie: '#F5F5F5',
  borde: '#9E9E9E',
  enLinea: '#C8E6C9',
  enLineaTexto: '#1B5E20',
  sinSenal: '#FFE0B2',
  sinSenalTexto: '#BF360C',
  error: '#C62828',
  mosaicos: { publicar: '#E8F5E9', productos: '#FBE9E7', pedidos: '#FFF8E1', ventas: '#E3F2FD', mensajes: '#F3E5F5' },
};

export const espacio = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };

export const toque = {
  minimo: 48, // dp, mínimo accesible
  boton: 56,
};

export const texto = {
  pequeno: 14,
  base: 18,
  titulo: 22,
  grande: 28,
  icono: 36,
};
