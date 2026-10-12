import { Pressable, StyleSheet, Text } from 'react-native';
import { colores, espacio, texto, toque } from '../tema/tema';

/** Botón principal: alto mínimo de 56 dp y texto grande (RNF-02). */
export function BotonGrande({ titulo, onPress, variante = 'primario', deshabilitado = false, accessibilityHint }) {
  const primario = variante === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primario ? styles.primario : styles.secundario,
        deshabilitado && styles.deshabilitado,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.texto, { color: primario ? '#FFFFFF' : colores.primario }]}>{titulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: toque.boton,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: espacio.l,
    marginVertical: espacio.s,
  },
  primario: { backgroundColor: colores.primario },
  secundario: { backgroundColor: colores.fondo, borderWidth: 2, borderColor: colores.primario },
  deshabilitado: { backgroundColor: '#E0E0E0', borderColor: '#E0E0E0' },
  texto: { fontSize: texto.base, fontWeight: '700' },
});
