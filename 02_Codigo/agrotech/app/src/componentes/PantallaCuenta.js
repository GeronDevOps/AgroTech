import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Mosaico } from './Mosaico';
import { BotonGrande } from './BotonGrande';
import { api } from '../api/cliente';
import { useBase } from '../hooks/useBase';
import { useSesion } from '../sesion/SesionContext';
import { useTiempoReal } from '../tiempoReal/TiempoRealContext';
import { colores, espacio, texto } from '../tema/tema';

/** «Mi cuenta»: perfil (CU-09), privacidad (CU-20), avisos (CU-16) y reportes (CU-19), a un toque cada uno. */
export function PantallaCuenta() {
  const router = useRouter();
  const base = useBase();
  const { usuario, cerrarSesion } = useSesion();
  const { versionNotificaciones } = useTiempoReal();
  const [sinLeer, setSinLeer] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionNotificaciones solo dispara la recarga
  useFocusEffect(useCallback(() => { api.notificaciones().then((r) => setSinLeer(r.sinLeer)).catch(() => {}); }, [versionNotificaciones]));

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Text style={styles.nombre} accessibilityRole="header">{usuario.nombres} {usuario.apellidos}</Text>
      <Text style={styles.sub}>{usuario.correo} · {usuario.municipio}</Text>
      <View style={styles.rejilla}>
      <Mosaico icono="👤" titulo="Mi perfil" color={colores.mosaicos.publicar} onPress={() => router.push(`${base}/perfil`)} />
      <Mosaico icono="🔔" titulo="Avisos" detalle={sinLeer ? `${sinLeer} sin leer` : null} alerta={sinLeer > 0} color={colores.mosaicos.pedidos} onPress={() => router.push(`${base}/avisos`)} />
      <Mosaico icono="🔒" titulo="Privacidad y datos" color={colores.mosaicos.ventas} onPress={() => router.push(`${base}/privacidad`)} />
      <Mosaico icono="🚩" titulo="Mis reportes" color={colores.mosaicos.mensajes} onPress={() => router.push(`${base}/reportes`)} />
      </View>
      <BotonGrande titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, gap: espacio.m },
  nombre: { fontSize: texto.grande, fontWeight: '800', color: colores.texto },
  sub: { fontSize: texto.pequeno, color: colores.textoSecundario },
  // Rejilla de 2 columnas como el inicio del productor: en una columna el flexBasis del mosaico se aplicaba a la altura.
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
});
