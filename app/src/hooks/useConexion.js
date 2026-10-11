import { useNetInfo } from '@react-native-community/netinfo';

/**
 * Estado de la red para el modo sin conexión (RF-17).
 * isInternetReachable puede ser null mientras se comprueba: se asume conectado hasta saberlo.
 */
export function useConexion() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const enLinea = isConnected !== false && isInternetReachable !== false;
  return { enLinea };
}
