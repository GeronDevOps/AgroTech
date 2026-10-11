import { Pressable, StyleSheet, Text } from 'react-native';
import { colores, espacio, texto } from '../tema/tema';

/** Acceso grande con ícono y texto (inicio del productor, wireframe 1). */
/** `alerta` resalta el detalle en rojo (p. ej. pedidos pendientes, Fase 4). */
export function Mosaico({ icono, titulo, detalle, alerta = false, color, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detalle ? `${titulo}, ${detalle}` : titulo}
      onPress={onPress}
      style={({ pressed }) => [styles.mosaico, { backgroundColor: color }, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.icono} accessibilityElementsHidden importantForAccessibility="no">{icono}</Text>
      <Text style={styles.titulo}>{titulo}</Text>
      {detalle ? <Text style={[styles.detalle, alerta && styles.alerta]}>{detalle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mosaico: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacio.m,
  },
  icono: { fontSize: texto.icono, color: colores.texto, marginBottom: espacio.s },
  titulo: { fontSize: texto.base, fontWeight: '700', color: colores.texto, textAlign: 'center' },
  detalle: { fontSize: texto.pequeno, fontWeight: '700', color: colores.textoSecundario, marginTop: espacio.xs },
  alerta: { color: colores.error },
});
