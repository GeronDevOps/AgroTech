import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * CU-02 paso 2: tomar o elegir la foto y comprimirla en el teléfono (RNF-09).
 * - Foto: 1024 px de ancho, JPEG calidad 0,6 → normalmente 80–200 KB (límite del servidor: 300 KB).
 * - Miniatura: 320 px, calidad 0,5 → ~15–25 KB, la que se descarga en el catálogo.
 */
const ANCHO_FOTO = 1024;
const ANCHO_MINIATURA = 320;

export class ErrorFoto extends Error {}

async function comprimir(uri, ancho, calidad) {
  const imagen = await ImageManipulator.manipulate(uri).resize({ width: ancho }).renderAsync();
  const r = await imagen.saveAsync({ compress: calidad, format: SaveFormat.JPEG });
  return { uri: r.uri, ancho: r.width, alto: r.height };
}

/** origen: 'camara' | 'galeria'. Devuelve null si el usuario cancela. */
export async function obtenerFoto(origen) {
  const permiso = origen === 'camara'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    throw new ErrorFoto(origen === 'camara'
      ? 'AgroTech necesita permiso para usar la cámara. Actívelo en los ajustes del teléfono.'
      : 'AgroTech necesita permiso para ver sus fotos. Actívelo en los ajustes del teléfono.');
  }
  const opciones = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 };
  const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (r.canceled || !r.assets || !r.assets[0]) return null;

  const original = r.assets[0].uri;
  const foto = await comprimir(original, ANCHO_FOTO, 0.6);
  const miniatura = await comprimir(original, ANCHO_MINIATURA, 0.5);
  return { foto, miniatura };
}
