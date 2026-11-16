import { View } from 'react-native';
import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';
import { AvisoPedidoNuevo } from '../../componentes/AvisoPedidoNuevo';

export default function ProductorLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={opcionesEncabezado}>
        <Stack.Screen name="index" options={{ title: 'AgroTech' }} />
        <Stack.Screen name="publicar" options={{ title: 'Publicar producto' }} />
        <Stack.Screen name="productos" options={{ title: 'Mis productos' }} />
        <Stack.Screen name="editar/[id]" options={{ title: 'Precio y cantidad' }} />
        <Stack.Screen name="pedidos" options={{ title: 'Mis pedidos' }} />
        <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat del pedido' }} />
        <Stack.Screen name="ventas" options={{ title: 'Mis ventas' }} />
        <Stack.Screen name="mensajes" options={{ title: 'Mensajes' }} />
        <Stack.Screen name="cuenta" options={{ title: 'Mi cuenta' }} />
        <Stack.Screen name="perfil" options={{ title: 'Mi perfil' }} />
        <Stack.Screen name="privacidad" options={{ title: 'Privacidad y datos' }} />
        <Stack.Screen name="avisos" options={{ title: 'Avisos' }} />
        <Stack.Screen name="reportar" options={{ title: 'Reportar' }} />
        <Stack.Screen name="reportes" options={{ title: 'Mis reportes' }} />
      </Stack>
      {/* Pedido nuevo en tiempo real, en cualquier pantalla del productor (CA-06). */}
      <AvisoPedidoNuevo />
    </View>
  );
}
