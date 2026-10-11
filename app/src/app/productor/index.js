import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Mosaico } from '../../componentes/Mosaico';
import { BotonGrande } from '../../componentes/BotonGrande';
import { useSesion } from '../../sesion/SesionContext';
import { api } from '../../api/cliente';
import { colores, espacio, texto } from '../../tema/tema';

/** Inicio del productor (wireframe 1): cada tarea crítica queda a un toque (RNF-02). */
export default function InicioProductor() {
  const router = useRouter();
  const { usuario, cerrarSesion } = useSesion();
  const [pendientes, setPendientes] = useState(0);

  // Al volver al inicio se cuentan los pedidos por atender (RF-13). Sin red se conserva el último dato.
  useFocusEffect(useCallback(() => {
    let vigente = true;
    api.pedidos('activos')
      .then((r) => { if (vigente) setPendientes(r.pedidos.filter((p) => p.estado === 'PENDIENTE').length); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []));

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Text style={styles.saludo} accessibilityRole="header">Hola, {usuario.nombres}</Text>
      <View style={styles.rejilla}>
        <Mosaico icono="＋" titulo="Publicar producto" color={colores.mosaicos.publicar} onPress={() => router.push('/productor/publicar')} />
        <Mosaico icono="🧺" titulo="Mis productos" color={colores.mosaicos.productos} onPress={() => router.push('/productor/productos')} />
        <Mosaico
          icono="▤" titulo="Mis pedidos" color={colores.mosaicos.pedidos}
          detalle={pendientes ? `${pendientes} por atender` : null} alerta={pendientes > 0}
          onPress={() => router.push('/productor/pedidos')} />
        <Mosaico icono="▲" titulo="Mis ventas" color={colores.mosaicos.ventas} onPress={() => router.push('/productor/ventas')} />
        <Mosaico icono="✉" titulo="Mensajes" color={colores.mosaicos.mensajes} onPress={() => router.push('/productor/mensajes')} />
      </View>
      <BotonGrande titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m },
  saludo: { fontSize: texto.grande, fontWeight: '700', color: colores.texto, marginVertical: espacio.m },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, marginBottom: espacio.l },
});
