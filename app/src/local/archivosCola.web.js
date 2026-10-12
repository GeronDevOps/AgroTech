/**
 * Vista web (solo revisión de pantallas en desarrollo): no hay sistema de archivos;
 * las fotos en cola se conservan como URI de datos dentro de la base local.
 */
async function aDataUri(uri) {
  if (uri.startsWith('data:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(blob);
  });
}

export async function guardarFotosCola(_id, fotos) {
  return { foto: await aDataUri(fotos.foto.uri), miniatura: await aDataUri(fotos.miniatura.uri) };
}

export async function borrarFotosCola() {}
