'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Almacenamiento de fotos en disco (desarrollo y pruebas).
 * Interfaz común con el driver de Amazon S3 (AGRO-16, fase 7):
 *   guardar(clave, buffer, tipo) · eliminar(clave) · urlPublica(clave, base)
 * La clave es relativa, p. ej. "productos/<idProductor>/<idProducto>.jpg"; es lo que se guarda en producto.foto_url.
 */
function createAlmacenFotosLocal({ dir }) {
  const ruta = (clave) => {
    const destino = path.resolve(dir, clave);
    if (!destino.startsWith(path.resolve(dir) + path.sep)) throw new Error('Clave de foto inválida.');
    return destino;
  };

  return {
    tipo: 'local',
    dir,
    async guardar(clave, buffer) {
      const destino = ruta(clave);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, buffer);
    },
    async eliminar(clave) {
      await fs.rm(ruta(clave), { force: true });
    },
    urlPublica(clave, base) {
      return `${base}/${clave}`;
    },
  };
}

module.exports = { createAlmacenFotosLocal };
