import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colores, espacio, texto, toque } from '../tema/tema';

/**
 * Grupo de opciones táctiles (chips grandes) en lugar de texto libre (wireframe 2).
 * opciones: [{ valor, texto, icono? }]. Un toque elige; se marca con borde, fondo y ✓ (no solo color).
 */
export function Opciones({ etiqueta, opciones, valor, onCambiar, error, testID }) {
  return (
    <View style={styles.contenedor} testID={testID}>
      {etiqueta ? <Text style={styles.etiqueta}>{etiqueta}</Text> : null}
      <View style={styles.fila} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
        {opciones.map((o) => {
          const elegida = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityLabel={o.texto}
              accessibilityState={{ selected: elegida, checked: elegida }}
              onPress={() => onCambiar(o.valor)}
              style={({ pressed }) => [styles.chip, elegida && styles.elegida, error && !valor && styles.conError, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.texto, elegida && styles.textoElegida]}>
                {elegida ? '✓ ' : ''}{o.icono ? `${o.icono} ` : ''}{o.texto}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: espacio.m },
  etiqueta: { fontSize: texto.base, fontWeight: '700', color: colores.texto, marginBottom: espacio.xs },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: {
    minHeight: toque.minimo, justifyContent: 'center', paddingHorizontal: espacio.m,
    borderRadius: 24, borderWidth: 2, borderColor: colores.borde, backgroundColor: colores.fondo,
  },
  elegida: { borderColor: colores.primario, backgroundColor: colores.primarioClaro },
  conError: { borderColor: colores.error },
  texto: { fontSize: texto.base, color: colores.texto },
  textoElegida: { color: colores.enLineaTexto, fontWeight: '700' },
  error: { fontSize: texto.pequeno, color: colores.error, fontWeight: '600', marginTop: espacio.xs },
});
