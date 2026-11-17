import { Stack } from 'expo-router';
import { opcionesEncabezado } from '../../componentes/encabezado';

/** Panel de administración (CU-18 · RF-18). Pensado para la vista web; también funciona en el teléfono. */
export default function AdministradorLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen name="index" options={{ title: 'Panel de administración' }} />
      <Stack.Screen name="reportes" options={{ title: 'Reportes' }} />
      <Stack.Screen name="reporte/[id]" options={{ title: 'Revisar reporte' }} />
      <Stack.Screen name="usuarios" options={{ title: 'Usuarios' }} />
      <Stack.Screen name="usuario/[id]" options={{ title: 'Usuario' }} />
      <Stack.Screen name="supresiones" options={{ title: 'Solicitudes de supresión' }} />
      <Stack.Screen name="bitacora" options={{ title: 'Bitácora' }} />
    </Stack>
  );
}
