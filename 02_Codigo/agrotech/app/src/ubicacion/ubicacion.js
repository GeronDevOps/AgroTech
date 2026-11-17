import * as Location from 'expo-location';

/**
 * CU-12 paso 2: ubicación del teléfono, solo con permiso y solo cuando el usuario activa "Cerca de mí"
 * o "Usar mi ubicación" en el perfil. Si el permiso se niega o falla, devuelve null y la API usa
 * el municipio del perfil (A1).
 */
export async function ubicacionDelTelefono() {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: Math.round(p.coords.latitude * 1e5) / 1e5, lon: Math.round(p.coords.longitude * 1e5) / 1e5 };
  } catch {
    return null;
  }
}
