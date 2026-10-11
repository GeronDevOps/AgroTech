import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { API_URL } from '../api/cliente';

/**
 * Estado de la red para el modo sin conexión (RF-17).
 * "Con internet" se comprueba contra el servidor de AgroTech (GET /salud) y no contra un sitio externo:
 * en zona rural puede haber datos móviles sin llegar a la API, y eso para la app es "Sin señal".
 * isInternetReachable puede ser null mientras se comprueba: se asume conectado hasta saberlo.
 */
NetInfo.configure({
  reachabilityUrl: `${API_URL}/api/v1/salud`,
  reachabilityTest: async (respuesta) => respuesta.status === 200,
  reachabilityShortTimeout: 5 * 1000, // sin señal: se vuelve a probar cada 5 s
  reachabilityLongTimeout: 60 * 1000, // con señal: cada minuto
  reachabilityRequestTimeout: 8 * 1000,
});

export function useConexion() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const enLinea = isConnected !== false && isInternetReachable !== false;
  return { enLinea };
}
