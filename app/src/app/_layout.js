import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ROLES, SesionProvider, useSesion } from '../sesion/SesionContext';

/**
 * Navegación por rol (AGRO-3).
 * Cada grupo de pantallas solo existe cuando su condición (guard) se cumple:
 * sin sesión → bienvenida/acceso; PRODUCTOR → /productor; CONSUMIDOR → /consumidor.
 */
export default function RootLayout() {
  return (
    <SesionProvider>
      <StatusBar style="dark" />
      <Navegador />
    </SesionProvider>
  );
}

function Navegador() {
  const { rol } = useSesion();
  return (
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
  );
}
