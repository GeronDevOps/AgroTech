import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';

export default function ProductorLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen name="index" options={{ title: 'AgroTech' }} />
      <Stack.Screen name="publicar" options={{ title: 'Publicar producto' }} />
      <Stack.Screen name="productos" options={{ title: 'Mis productos' }} />
      <Stack.Screen name="editar/[id]" options={{ title: 'Precio y cantidad' }} />
      <Stack.Screen name="pedidos" options={{ title: 'Mis pedidos' }} />
      <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
      <Stack.Screen name="ventas" options={{ title: 'Mis ventas' }} />
      <Stack.Screen name="mensajes" options={{ title: 'Mensajes' }} />
    </Stack>
  );
}
