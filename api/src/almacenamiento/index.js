'use strict';

const { createAlmacenFotosLocal } = require('./fotos-local');

/**
 * Elige el driver de fotos según la configuración (FOTOS_DRIVER).
 * El de S3 se carga solo cuando se usa, así el desarrollo local no inicializa el SDK de AWS.
 * @param {typeof import('../config/env').fotos} fotos
 */
function crearAlmacenFotos(fotos) {
  if (fotos.driver === 's3') {
    const { createAlmacenFotosS3 } = require('./fotos-s3');
    return createAlmacenFotosS3({ bucket: fotos.s3Bucket, region: fotos.s3Region, urlBase: fotos.urlBase });
  }
  return createAlmacenFotosLocal({ dir: fotos.dir });
}

module.exports = { crearAlmacenFotos };
