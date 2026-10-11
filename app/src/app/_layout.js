import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ROLES, SesionProvider, useSesion } from '../sesion/SesionContext';
import { SincronizacionProvider } from '../sync/SincronizacionContext';
import { TiempoRealProvider } from '../tiempoReal/TiempoRealContext';
import { useNotificacionesPush } from '../notificaciones/push';
import { colores } from '../tema/tema';

/**
 * Navegación por rol (AGRO-3) con sesión real (AGRO-5).
 * Cada grupo de pantallas solo existe cuando su condición (guard) se cumple:
 * sin sesión → bienvenida/acceso; PRODUCTOR → /productor; CONSUMIDOR → /consumidor.
 */
export default function RootLayout() {
  return (
    <SesionProvider>
      <SincronizacionProvider>
        <TiempoRealProvider>
          <StatusBar style="dark" />
          <Navegador />
        </TiempoRealProvider>
      </SincronizacionProvider>
    </SesionProvider>
  );
}

function Navegador() {
  const { rol, cargando, usuario } = useSesion();
  useNotificacionesPush(usuario);
  return (
    <View style={styles.raiz}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!rol}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={rol === ROLES.PRODUCTOR}>
          <Stack.Screen name="productor" />
        </Stack.Protected>
        <Stack.Protected guard={rol === ROLES.CONSUMIDOR}>
          <Stack.Screen name="consumidor" />
        </Stack.Protected>
      </Stack>
      {cargando ? (
        // Mientras se lee el almacén seguro se cubre la pantalla para no mostrar la bienvenida un instante.
        <View style={styles.cargando} accessibilityLabel="Cargando">
          <ActivityIndicator size="large" color={colores.primario} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cargando: { ...StyleSheet.absoluteFillObject, backgroundColor: colores.fondo, alignItems: 'center', justifyContent: 'center' },
});
