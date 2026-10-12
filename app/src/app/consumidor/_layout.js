import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';
import { CarritoProvider } from '../../carrito/CarritoContext';

/** El carrito vive mientras dura la sesión del consumidor (se comparte entre catálogo, detalle y carrito). */
export default function ConsumidorLayout() {
  return (
    <CarritoProvider>
      <Stack screenOptions={opcionesEncabezado}>
        <Stack.Screen name="index" options={{ title: 'Catálogo' }} />
        <Stack.Screen name="producto/[id]" options={{ title: 'Producto' }} />
        <Stack.Screen name="carrito" options={{ title: 'Mi carrito' }} />
        <Stack.Screen name="pedidos" options={{ title: 'Mis pedidos' }} />
        <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat del pedido' }} />
        <Stack.Screen name="mensajes" options={{ title: 'Mensajes' }} />
        <Stack.Screen name="productor/[id]" options={{ title: 'Opiniones' }} />
      </Stack>
    </CarritoProvider>
  );
}
