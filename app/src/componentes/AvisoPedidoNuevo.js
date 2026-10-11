import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTiempoReal } from '../tiempoReal/TiempoRealContext';
import { colores, espacio, texto, toque } from '../tema/tema';

/**
 * Aviso dentro de la app de un pedido nuevo (CU-04 paso 4 en tiempo real; CU-16 A1 cuando no hay push).
 * Queda visible hasta que el productor lo abre o lo cierra (no desaparece solo: RNF-02).
 */
export function AvisoPedidoNuevo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ultimoPedidoNuevo, descartarAvisoPedido } = useTiempoReal();
  if (!ultimoPedidoNuevo) return null;
  return (
    <View style={[styles.caja, { bottom: insets.bottom + espacio.m }]} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="aviso-pedido-nuevo">
      <Text style={styles.icono} importantForAccessibility="no">🧺</Text>
      <Text style={styles.texto}>¡Tiene un pedido nuevo!</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver pedido nuevo"
        onPress={() => { descartarAvisoPedido(); router.push(`/productor/pedido/${ultimoPedidoNuevo.idPedido}`); }}
        style={styles.ver}
      >
        <Text style={styles.verTexto}>Ver</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={descartarAvisoPedido} style={styles.cerrar} hitSlop={8}>
        <Text style={styles.cerrarTexto}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    position: 'absolute', left: espacio.m, right: espacio.m, flexDirection: 'row', alignItems: 'center', gap: espacio.s,
    backgroundColor: colores.texto, borderRadius: 14, paddingVertical: espacio.s, paddingHorizontal: espacio.m,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  icono: { fontSize: 26 },
  texto: { flex: 1, color: '#FFFFFF', fontSize: texto.base, fontWeight: '700' },
  ver: { minHeight: toque.minimo, minWidth: 64, borderRadius: 10, backgroundColor: colores.enLinea, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espacio.m },
  verTexto: { color: colores.enLineaTexto, fontWeight: '800', fontSize: texto.base },
  cerrar: { minHeight: toque.minimo, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  cerrarTexto: { color: '#FFFFFF', fontSize: texto.titulo },
});
