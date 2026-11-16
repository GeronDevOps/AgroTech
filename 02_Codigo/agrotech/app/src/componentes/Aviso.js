import { StyleSheet, Text, View } from 'react-native';
import { colores, espacio, texto } from '../tema/tema';

const TIPOS = {
  error: { fondo: '#FFEBEE', borde: colores.error, texto: '#8E0000', icono: '!' },
  info: { fondo: colores.primarioClaro, borde: colores.primario, texto: colores.enLineaTexto, icono: 'i' },
  sinSenal: { fondo: colores.sinSenal, borde: colores.sinSenalTexto, texto: colores.sinSenalTexto, icono: '⚠' },
};

/** Mensaje destacado con ícono y texto (nunca solo color). Los lectores de pantalla lo anuncian. */
export function Aviso({ tipo = 'error', mensaje, children, testID }) {
  const t = TIPOS[tipo];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID={testID}
      style={[styles.caja, { backgroundColor: t.fondo, borderColor: t.borde }]}
    >
      <Text style={[styles.icono, { color: t.texto }]} importantForAccessibility="no">{t.icono}</Text>
      <View style={styles.cuerpo}>
        <Text style={[styles.texto, { color: t.texto }]}>{mensaje}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { flexDirection: 'row', borderWidth: 2, borderRadius: 12, padding: espacio.m, marginBottom: espacio.m },
  icono: { fontSize: texto.titulo, fontWeight: '800', width: 28 },
  cuerpo: { flex: 1 },
  texto: { fontSize: texto.base, fontWeight: '600' },
});
