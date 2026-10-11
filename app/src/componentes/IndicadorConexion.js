import { StyleSheet, Text, View } from 'react-native';
import { useConexion } from '../hooks/useConexion';
import { colores, espacio, texto } from '../tema/tema';

/** Indicador permanente de conexión (wireframes UCD, Entrega 3). */
export function IndicadorConexion() {
  const { enLinea } = useConexion();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={enLinea ? 'Con conexión a internet' : 'Sin señal: trabajando sin conexión'}
      style={[styles.chip, { backgroundColor: enLinea ? colores.enLinea : colores.sinSenal }]}
    >
      <Text style={[styles.texto, { color: enLinea ? colores.enLineaTexto : colores.sinSenalTexto }]}>
        {enLinea ? 'En línea' : 'Sin señal'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: espacio.m, paddingVertical: espacio.xs },
  texto: { fontSize: texto.pequeno, fontWeight: '700' },
});
