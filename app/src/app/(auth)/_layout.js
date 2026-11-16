import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';

export default function AuthLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="iniciar-sesion" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="recuperar" options={{ title: 'Recuperar contraseña' }} />
    </Stack>
  );
}
