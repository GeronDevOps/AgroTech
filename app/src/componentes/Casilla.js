import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colores, espacio, texto, toque } from '../tema/tema';

/** Casilla de verificación grande: toda la fila es tocable (≥ 48 dp). */
export function Casilla({ marcada, onCambiar, etiqueta, error, children, testID }) {
  return (
    <View style={styles.contenedor}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcada }}
        accessibilityLabel={etiqueta}
        onPress={() => onCambiar(!marcada)}
        style={styles.fila}
        testID={testID}
      >
        <View style={[styles.cuadro, marcada && styles.cuadroMarcado, error && styles.cuadroError]}>
          {marcada ? <Text style={styles.chulo}>✓</Text> : null}
        </View>
        <Text style={styles.etiqueta}>{etiqueta}</Text>
      </Pressable>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: toque.minimo },
  cuadro: {
    width: 32, height: 32, borderRadius: 6, borderWidth: 2, borderColor: colores.borde,
    alignItems: 'center', justifyContent: 'center', marginRight: espacio.m,
  },
  cuadroMarcado: { backgroundColor: colores.primario, borderColor: colores.primario },
  cuadroError: { borderColor: colores.error },
  chulo: { color: '#FFFFFF', fontSize: texto.base, fontWeight: '800' },
  etiqueta: { flex: 1, fontSize: texto.base, color: colores.texto },
  error: { fontSize: texto.pequeno, color: colores.error, fontWeight: '600', marginTop: espacio.xs },
});
