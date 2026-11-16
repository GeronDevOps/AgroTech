import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colores, espacio, texto, toque } from '../tema/tema';

/** Acceso al chat del pedido (CU-05) con los mensajes sin leer. */
export function BotonChat({ pedido, rol, contraparte }) {
  const router = useRouter();
  const n = pedido.mensajesSinLeer || 0;
  const cerrado = ['ENTREGADO', 'CANCELADO'].includes(pedido.estado);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chat con ${contraparte}${n ? `, ${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : ''}`}
      onPress={() => router.push(`/${rol === 'PRODUCTOR' ? 'productor' : 'consumidor'}/chat/${pedido.id}`)}
      style={({ pressed }) => [styles.boton, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.icono} importantForAccessibility="no">💬</Text>
      <View style={styles.cuerpo}>
        <Text style={styles.titulo}>Chat con {contraparte}</Text>
        <Text style={styles.detalle}>{cerrado ? 'Solo lectura' : 'Acuerden la entrega sin compartir su teléfono'}</Text>
      </View>
      {n ? <View style={styles.insignia}><Text style={styles.insigniaTexto}>{n}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: toque.boton + 8, padding: espacio.m, marginBottom: espacio.m,
    borderRadius: 14, borderWidth: 2, borderColor: '#8E24AA', backgroundColor: colores.mosaicos.mensajes,
  },
  icono: { fontSize: 28 },
  cuerpo: { flex: 1, minWidth: 0 },
  titulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  detalle: { fontSize: texto.pequeno, color: colores.textoSecundario },
  insignia: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: colores.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  insigniaTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: texto.pequeno },
});
