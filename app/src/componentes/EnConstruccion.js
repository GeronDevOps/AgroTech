import { StyleSheet, Text, View } from 'react-native';
import { colores, espacio, texto } from '../tema/tema';

/** Marcador de pantalla planificada: indica la tarjeta de Jira y la fase que la construye. */
export function EnConstruccion({ titulo, tarjeta, fase }) {
  return (
    <View style={styles.caja}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.texto}>Pantalla planificada en {fase}.</Text>
      <Text style={styles.tarjeta}>Tarjeta {tarjeta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  titulo: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto, marginBottom: espacio.s, textAlign: 'center' },
  texto: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center' },
  tarjeta: { fontSize: texto.pequeno, color: colores.primario, fontWeight: '700', marginTop: espacio.m },
});
