import { StyleSheet, Text, View } from 'react-native';
import { colores, espacio, texto } from '../tema/tema';

/** Estados del pedido con ícono + texto (nunca solo color, RNF-02). */
export const ESTADOS_PEDIDO = {
  PENDIENTE: { texto: 'Pendiente', icono: '⏳', fondo: '#FFF8E1', color: '#7A4F00' },
  ACEPTADO: { texto: 'Aceptado', icono: '✔', fondo: colores.primarioClaro, color: colores.enLineaTexto },
  EN_CAMINO: { texto: 'En camino', icono: '🚚', fondo: '#E3F2FD', color: '#0D47A1' },
  ENTREGADO: { texto: 'Entregado', icono: '✅', fondo: colores.enLinea, color: colores.enLineaTexto },
  CANCELADO: { texto: 'Cancelado', icono: '✖', fondo: '#FFEBEE', color: '#8E0000' },
};

export const ESTADOS_PAGO = {
  NO_APLICA: { texto: 'Pago contra entrega', icono: '💵', fondo: colores.superficie, color: colores.textoSecundario },
  PENDIENTE: { texto: 'Pago pendiente', icono: '💳', fondo: '#FFF8E1', color: '#7A4F00' },
  APROBADO: { texto: 'Pagado en línea', icono: '💳', fondo: colores.enLinea, color: colores.enLineaTexto },
  RECHAZADO: { texto: 'Pago rechazado', icono: '⚠', fondo: '#FFEBEE', color: '#8E0000' },
  ANULADO: { texto: 'Pago anulado', icono: '⚠', fondo: '#FFEBEE', color: '#8E0000' },
};

export function Chip({ def, testID }) {
  return (
    <View style={[styles.chip, { backgroundColor: def.fondo }]} testID={testID}>
      <Text style={[styles.texto, { color: def.color }]}>{def.icono} {def.texto}</Text>
    </View>
  );
}

const PASOS = ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'ENTREGADO'];

/** Línea de tiempo del pedido (diagrama de estados a): el paso actual resaltado. */
export function LineaTiempo({ estado }) {
  if (estado === 'CANCELADO') return <Chip def={ESTADOS_PEDIDO.CANCELADO} />;
  const actual = PASOS.indexOf(estado);
  return (
    <View style={styles.linea} accessibilityLabel={`Estado: ${ESTADOS_PEDIDO[estado].texto}, paso ${actual + 1} de 4`}>
      {PASOS.map((p, i) => (
        <View key={p} style={styles.paso}>
          <View style={[styles.punto, i <= actual && styles.puntoHecho]}>
            <Text style={[styles.puntoTexto, i <= actual && { color: '#FFFFFF' }]}>{i < actual ? '✓' : i + 1}</Text>
          </View>
          <Text style={[styles.pasoTexto, i === actual && styles.pasoActual]}>{ESTADOS_PEDIDO[p].texto}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: espacio.s + 2, paddingVertical: 3 },
  texto: { fontSize: texto.pequeno, fontWeight: '700' },
  linea: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: espacio.s },
  paso: { flex: 1, alignItems: 'center' },
  punto: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colores.borde, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo },
  puntoHecho: { backgroundColor: colores.primario, borderColor: colores.primario },
  puntoTexto: { fontSize: texto.pequeno, fontWeight: '800', color: colores.textoSecundario },
  pasoTexto: { fontSize: 12, color: colores.textoSecundario, marginTop: 4, textAlign: 'center' },
  pasoActual: { fontWeight: '800', color: colores.texto },
});
