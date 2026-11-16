import { Directory, File, Paths } from 'expo-file-system';

/**
 * Fotos de las publicaciones en cola (CU-02 sin red).
 * La foto comprimida queda en la caché temporal, que el sistema puede borrar: se copia a
 * documentos/cola/ hasta que la publicación llegue al servidor.
 * CU-17 A4 (poco almacenamiento): la caché de imágenes del catálogo la libera el sistema; estas no.
 */
const carpeta = () => new Directory(Paths.document, 'cola');

export async function guardarFotosCola(id, fotos) {
  const dir = carpeta();
  dir.create({ idempotent: true, intermediates: true });
  const copiar = async (origen, nombre) => {
    const destino = new File(dir, nombre);
    await new File(origen).copy(destino, { overwrite: true });
    return destino.uri;
  };
  return {
    foto: await copiar(fotos.foto.uri, `${id}.jpg`),
    miniatura: await copiar(fotos.miniatura.uri, `${id}_min.jpg`),
  };
}

export async function borrarFotosCola(archivos) {
  if (!archivos) return;
  for (const uri of [archivos.foto, archivos.miniatura]) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      // ya no existe
    }
  }
}
