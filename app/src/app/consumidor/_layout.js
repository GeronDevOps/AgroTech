import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';

export default function ConsumidorLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen name="index" options={{ title: 'Catálogo' }} />
      <Stack.Screen name="producto/[id]" options={{ title: 'Producto' }} />
      <Stack.Screen name="carrito" options={{ title: 'Mi carrito' }} />
      <Stack.Screen name="pedidos" options={{ title: 'Mis pedidos' }} />
    </Stack>
  );
}
