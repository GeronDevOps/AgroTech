import { StyleSheet, Text, View } from 'react-native';
import { Chip, ESTADOS_PAGO, ESTADOS_PEDIDO, LineaTiempo } from './EstadoPedido';
import { fechaCorta } from './TarjetaPedido';
import { unidad as datosUnidad } from '../datos/catalogo';
import { formatoCantidad, formatoPesos } from '../utilidades/formato';
import { colores, espacio, texto } from '../tema/tema';

/** Comprobante del pedido (CU-04 paso 4) y detalle para ambas partes (CU-13, CU-15). */
export function DetallePedido({ pedido, contraparte }) {
  return (
    <View>
      <Text style={styles.titulo} accessibilityRole="header">Pedido a {contraparte}</Text>
      <Text style={styles.sub}>Hecho el {fechaCorta(pedido.fecha)} · N.º {pedido.id.slice(0, 8).toUpperCase()}</Text>
      <LineaTiempo estado={pedido.estado} />
      {pedido.estado === 'CANCELADO' && pedido.motivoCancelacion ? <Text style={styles.motivo}>Motivo: {pedido.motivoCancelacion}</Text> : null}

      <View style={styles.caja}>
        {pedido.items.map((i) => {
          const u = datosUnidad(i.unidad);
          return (
            <View key={i.idProducto} style={styles.item}>
              <Text style={styles.itemNombre}>{formatoCantidad(i.cantidad)} {i.cantidad === 1 ? u.singular : u.plural} de {i.nombre}</Text>
              <Text style={styles.itemValor}>{formatoPesos(i.subtotal)}</Text>
            </View>
          );
        })}
        <Text style={styles.precio}>Precios pactados al confirmar el pedido.</Text>
        <View style={[styles.item, styles.totalFila]}>
          <Text style={styles.totalTexto}>Total</Text>
          <Text style={styles.totalTexto} testID="total-pedido">{formatoPesos(pedido.total)}</Text>
        </View>
      </View>

      <View style={styles.caja}>
        <Text style={styles.dato}>📍 {pedido.puntoEntrega}</Text>
        <Text style={styles.dato}>🕑 {pedido.franjaEntrega}</Text>
        <Chip def={ESTADOS_PAGO[pedido.estadoPago]} testID="estado-pago" />
      </View>

      {pedido.historial && pedido.historial.length ? (
        <View style={styles.caja}>
          <Text style={styles.subtitulo}>Historial</Text>
          {pedido.historial.map((h) => (
            <Text key={`${h.estadoNuevo}-${h.fecha}`} style={styles.historial}>
              {fechaCorta(h.fecha)} · {ESTADOS_PEDIDO[h.estadoNuevo].icono} {ESTADOS_PEDIDO[h.estadoNuevo].texto}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  sub: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.s },
  motivo: { fontSize: texto.base, color: '#8E0000', marginBottom: espacio.s },
  caja: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginVertical: espacio.s, gap: espacio.xs },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.m },
  itemNombre: { fontSize: texto.base, color: colores.texto, flex: 1 },
  itemValor: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  precio: { fontSize: 12, color: colores.textoSecundario },
  totalFila: { borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: espacio.xs },
  totalTexto: { fontSize: texto.titulo, fontWeight: '800', color: colores.primario },
  dato: { fontSize: texto.base, color: colores.texto },
  subtitulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  historial: { fontSize: texto.pequeno, color: colores.texto },
});
