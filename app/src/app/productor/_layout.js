import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';

export default function ProductorLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen name="index" options={{ title: 'AgroTech' }} />
      <Stack.Screen name="publicar" options={{ title: 'Publicar producto' }} />
      <Stack.Screen name="pedidos" options={{ title: 'Mis pedidos' }} />
      <Stack.Screen name="ventas" options={{ title: 'Mis ventas' }} />
      <Stack.Screen name="mensajes" options={{ title: 'Mensajes' }} />
    </Stack>
  );
}
