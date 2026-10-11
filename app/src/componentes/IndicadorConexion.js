import { StyleSheet, Text, View } from 'react-native';
import { useConexion } from '../hooks/useConexion';
import { useSincronizacion } from '../sync/SincronizacionContext';
import { colores, espacio, texto } from '../tema/tema';

/**
 * Indicador permanente de conexión (wireframes UCD, Entrega 3) con el estado de la cola (CU-17):
 * "En línea", "Sin señal", "Sincronizando…" y, si hay cambios en el teléfono, cuántos faltan por enviar.
 */
export function IndicadorConexion() {
  const { enLinea } = useConexion();
  const { pendientes, conError, sincronizando } = useSincronizacion();
  const enCola = pendientes + conError;
  const textoEstado = !enLinea ? 'Sin señal' : sincronizando && pendientes ? 'Sincronizando…' : 'En línea';
  const descripcion = [
    enLinea ? 'Con conexión a internet' : 'Sin señal: trabajando sin conexión',
    pendientes ? `${pendientes} ${pendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'} por sincronizar` : null,
    conError ? `${conError} con error` : null,
  ].filter(Boolean).join('. ');
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={descripcion}
      testID="indicador-conexion"
      style={[styles.chip, { backgroundColor: enLinea ? colores.enLinea : colores.sinSenal }]}
    >
      <Text style={[styles.texto, { color: enLinea ? colores.enLineaTexto : colores.sinSenalTexto }]}>{textoEstado}</Text>
      {enCola ? (
        <View style={[styles.contador, conError ? styles.contadorError : null]}>
          <Text style={styles.contadorTexto}>{conError ? '⚠' : '⏳'} {enCola}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: espacio.s, paddingVertical: espacio.xs },
  texto: { fontSize: texto.pequeno, fontWeight: '700' },
  contador: { backgroundColor: colores.sinSenalTexto, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  contadorError: { backgroundColor: colores.error },
  contadorTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
