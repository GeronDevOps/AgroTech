import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { categoria, unidad } from '../datos/catalogo';
import { formatoCantidad, formatoPesos } from '../utilidades/formato';
import { colores, espacio, texto } from '../tema/tema';

const ESTADOS = {
  ACTIVA: { texto: 'Activa', fondo: colores.enLinea, color: colores.enLineaTexto },
  AGOTADA: { texto: 'Agotada', fondo: '#FFEBEE', color: '#8E0000' },
  PAUSADA: { texto: 'Pausada', fondo: colores.superficie, color: colores.textoSecundario },
};

/** Estado en la cola del teléfono (CU-17): siempre con ícono y texto, nunca solo color (RNF-02). */
export const ESTADOS_SYNC = {
  PENDIENTE: { icono: '⏳', texto: 'Pendiente por sincronizar', fondo: colores.sinSenal, color: colores.sinSenalTexto },
  ENVIANDO: { icono: '⟳', texto: 'Enviando…', fondo: '#E3F2FD', color: '#0D47A1' },
  CON_ERROR: { icono: '⚠', texto: 'Con error', fondo: '#FFEBEE', color: '#8E0000' },
};

export function EstadoSync({ sync }) {
  const e = ESTADOS_SYNC[sync.estado] || ESTADOS_SYNC.PENDIENTE;
  return (
    <View style={[styles.estado, { backgroundColor: e.fondo }]} testID="estado-sync">
      <Text style={[styles.estadoTexto, { color: e.color }]}>{e.icono} {e.texto}</Text>
    </View>
  );
}

export function EstadoProducto({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.PAUSADA;
  return (
    <View style={[styles.estado, { backgroundColor: e.fondo }]}>
      <Text style={[styles.estadoTexto, { color: e.color }]}>{e.texto}</Text>
    </View>
  );
}

/** Foto con respaldo: mientras carga (o si falla) se ve el ícono de la categoría. */
export function FotoProducto({ uri, codigoCategoria, style }) {
  return (
    <View style={[styles.fotoCaja, style]}>
      <Text style={styles.fotoRespaldo} importantForAccessibility="no">{categoria(codigoCategoria).icono}</Text>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
    </View>
  );
}

/**
 * Tarjeta del catálogo (wireframe 3) y de "Mis productos".
 * Muestra lo que decide la compra: foto, nombre, precio por unidad, cantidad disponible y origen.
 */
export function TarjetaProducto({ producto, onPress, mostrarEstado = false, compacta = false }) {
  const u = unidad(producto.unidad);
  const sync = producto.sync ? `, ${(ESTADOS_SYNC[producto.sync.estado] || ESTADOS_SYNC.PENDIENTE).texto}` : '';
  const etiqueta = `${producto.nombre}, ${formatoPesos(producto.precio)} por ${u.singular}, ${formatoCantidad(producto.stock)} disponibles, ${producto.municipio}${sync}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [styles.tarjeta, compacta ? styles.tarjetaFila : styles.tarjetaRejilla, pressed && { opacity: 0.85 }]}
    >
      <FotoProducto uri={producto.miniaturaUrl} codigoCategoria={producto.categoria} style={compacta ? styles.fotoFila : styles.foto} />
      <View style={styles.cuerpo}>
        <Text style={styles.nombre} numberOfLines={2}>{producto.nombre}</Text>
        <Text style={styles.precio}>{formatoPesos(producto.precio)}<Text style={styles.porUnidad}> / {u.nombre}</Text></Text>
        <Text style={styles.detalle}>{formatoCantidad(producto.stock)} {producto.stock === 1 ? u.singular : u.plural}</Text>
        <Text style={styles.detalle} numberOfLines={1}>📍 {producto.municipio}</Text>
        {mostrarEstado && !(producto.sync && producto.sync.nueva) ? <EstadoProducto estado={producto.estado} /> : null}
        {mostrarEstado && producto.sync ? <EstadoSync sync={producto.sync} /> : null}
        {mostrarEstado && producto.sync && producto.sync.error ? (
          <Text style={styles.errorSync} numberOfLines={3}>{producto.sync.error.mensaje}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.fondo, borderRadius: 14, borderWidth: 1, borderColor: colores.borde,
    overflow: 'hidden', margin: espacio.xs,
  },
  // En la rejilla de 2 columnas cada tarjeta ocupa su mitad; en la lista vertical toma la altura de su contenido.
  tarjetaRejilla: { flex: 1 },
  tarjetaFila: { flexDirection: 'row', marginHorizontal: 0, marginVertical: espacio.s },
  foto: { width: '100%', aspectRatio: 4 / 3 },
  fotoFila: { width: 110, height: 110 },
  fotoCaja: { backgroundColor: colores.superficie, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fotoRespaldo: { fontSize: 40 },
  cuerpo: { padding: espacio.s, flex: 1, gap: 2 },
  nombre: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  precio: { fontSize: texto.base, fontWeight: '800', color: colores.primario },
  porUnidad: { fontSize: texto.pequeno, fontWeight: '600', color: colores.textoSecundario },
  detalle: { fontSize: texto.pequeno, color: colores.textoSecundario },
  estado: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: espacio.s, paddingVertical: 2, marginTop: espacio.xs },
  estadoTexto: { fontSize: texto.pequeno, fontWeight: '700' },
  errorSync: { fontSize: texto.pequeno, color: '#8E0000', marginTop: 2 },
});
