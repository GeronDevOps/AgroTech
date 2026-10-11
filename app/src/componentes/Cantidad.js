import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatoCantidad, leerNumero } from '../utilidades/formato';
import { colores, espacio, texto, toque } from '../tema/tema';

/**
 * Selector de cantidad "−  20  +" (wireframe 2): botones de 56 dp y campo numérico editable.
 * valor es texto para permitir escribir decimales ("2,5").
 */
export function Cantidad({ etiqueta, valor, onCambiar, error, minimo = 0, paso = 1, sufijo }) {
  const actual = leerNumero(valor, { decimales: true });
  const cambiar = (delta) => {
    const base = Number.isFinite(actual) ? actual : 0;
    onCambiar(formatoCantidad(Math.max(minimo, Math.round((base + delta) * 100) / 100)));
  };
  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={styles.fila}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Restar ${paso}`} onPress={() => cambiar(-paso)} style={styles.boton}>
          <Text style={styles.signo}>−</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={etiqueta}
          accessibilityHint={error}
          value={valor}
          onChangeText={(t) => onCambiar(t.replace(/[^\d,.]/g, ''))}
          keyboardType="decimal-pad"
          style={[styles.entrada, error && styles.entradaError]}
          textAlign="center"
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Sumar ${paso}`} onPress={() => cambiar(paso)} style={styles.boton}>
          <Text style={styles.signo}>+</Text>
        </Pressable>
        {sufijo ? <Text style={styles.sufijo}>{sufijo}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: espacio.m },
  etiqueta: { fontSize: texto.base, fontWeight: '700', color: colores.texto, marginBottom: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  boton: {
    width: toque.boton, height: toque.boton, borderRadius: 12, backgroundColor: colores.primarioClaro,
    borderWidth: 2, borderColor: colores.primario, alignItems: 'center', justifyContent: 'center',
  },
  signo: { fontSize: texto.grande, fontWeight: '800', color: colores.primario },
  entrada: {
    minWidth: 96, height: toque.boton, borderWidth: 2, borderColor: colores.borde, borderRadius: 12,
    fontSize: texto.titulo, fontWeight: '700', color: colores.texto, paddingHorizontal: espacio.s,
  },
  entradaError: { borderColor: colores.error },
  sufijo: { fontSize: texto.base, color: colores.textoSecundario, fontWeight: '700' },
  error: { fontSize: texto.pequeno, color: colores.error, fontWeight: '600', marginTop: espacio.xs },
});
