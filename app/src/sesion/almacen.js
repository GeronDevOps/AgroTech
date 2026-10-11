import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Almacén de la sesión (Entrega 3: "el token JWT se guarda en el almacén seguro del sistema,
 * nunca en SQLite"). En Android usa Keystore mediante expo-secure-store.
 * La vista web solo existe para revisar pantallas en desarrollo: allí se usa localStorage.
 */
const CLAVE = 'agrotech.sesion';
const enWeb = Platform.OS === 'web';

export async function leerSesion() {
  try {
    const texto = enWeb ? globalThis.localStorage?.getItem(CLAVE) : await SecureStore.getItemAsync(CLAVE);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null; // almacén ilegible: se pide iniciar sesión de nuevo
  }
}

export async function guardarSesion(sesion) {
  const texto = JSON.stringify(sesion);
  if (enWeb) globalThis.localStorage?.setItem(CLAVE, texto);
  else await SecureStore.setItemAsync(CLAVE, texto);
}

export async function borrarSesion() {
  try {
    if (enWeb) globalThis.localStorage?.removeItem(CLAVE);
    else await SecureStore.deleteItemAsync(CLAVE);
  } catch {
    // nada que borrar
  }
}
