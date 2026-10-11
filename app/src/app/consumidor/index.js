import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EnConstruccion } from '../../componentes/EnConstruccion';
import { BotonGrande } from '../../componentes/BotonGrande';
import { useSesion } from '../../sesion/SesionContext';
import { colores, espacio } from '../../tema/tema';

/** Catálogo del consumidor (wireframe 3). */
export default function Catalogo() {
  const router = useRouter();
  const { cerrarSesion } = useSesion();
  return (
    <View style={styles.pantalla}>
      <EnConstruccion titulo="Catálogo con filtros" tarjeta="AGRO-7 (RF-03)" fase="la Fase 3" />
      <View style={styles.acciones}>
        <BotonGrande titulo="Mi carrito" onPress={() => router.push('/consumidor/carrito')} />
        <BotonGrande titulo="Mis pedidos" variante="secundario" onPress={() => router.push('/consumidor/pedidos')} />
        <BotonGrande titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  acciones: { padding: espacio.m },
});
