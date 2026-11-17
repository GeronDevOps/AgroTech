import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, ESTADOS_PAGO, ESTADOS_PEDIDO } from './EstadoPedido';
import { unidad as datosUnidad } from '../datos/catalogo';
import { formatoCantidad, formatoPesos } from '../utilidades/formato';
import { colores, espacio, texto } from '../tema/tema';

const fechaCorta = (iso) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const resumenItems = (items) => items
  .map((i) => `${formatoCantidad(i.cantidad)} ${datosUnidad(i.unidad)[i.cantidad === 1 ? 'singular' : 'plural']} de ${i.nombre}`)
  .join(', ');

/** Pedido en las listas de "Mis pedidos" (CU-15) y "Pedidos recibidos" (CU-13). */
export function TarjetaPedido({ pedido, contraparte, onPress }) {
  const pagoVisible = pedido.metodoPago === 'EN_LINEA';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pedido de ${contraparte}, ${ESTADOS_PEDIDO[pedido.estado].texto}, total ${formatoPesos(pedido.total)}${pedido.mensajesSinLeer ? `, ${pedido.mensajesSinLeer} ${pedido.mensajesSinLeer === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.fila}>
        <Text style={styles.contraparte}>{contraparte}</Text>
        <Text style={styles.total}>{formatoPesos(pedido.total)}</Text>
      </View>
      <Text style={styles.items} numberOfLines={2}>{resumenItems(pedido.items)}</Text>
      <View style={styles.chips}>
        <Chip def={ESTADOS_PEDIDO[pedido.estado]} />
        {pagoVisible ? <Chip def={ESTADOS_PAGO[pedido.estadoPago]} /> : null}
        {pedido.mensajesSinLeer ? (
          <Chip def={{ icono: '💬', texto: `${pedido.mensajesSinLeer} ${pedido.mensajesSinLeer === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`, fondo: colores.mosaicos.mensajes, color: '#4A148C' }} />
        ) : null}
      </View>
      <Text style={styles.fecha}>Último cambio: {fechaCorta(pedido.actualizadoEn)} · {pedido.franjaEntrega}</Text>
    </Pressable>
  );
}

export { fechaCorta };

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderColor: colores.borde, borderRadius: 14, padding: espacio.m, marginBottom: espacio.m, backgroundColor: colores.fondo, gap: espacio.xs },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contraparte: { fontSize: texto.base, fontWeight: '800', color: colores.texto, flex: 1 },
  total: { fontSize: texto.base, fontWeight: '800', color: colores.primario },
  items: { fontSize: texto.pequeno, color: colores.texto },
  chips: { flexDirection: 'row', gap: espacio.s, flexWrap: 'wrap' },
  fecha: { fontSize: 12, color: colores.textoSecundario },
});
