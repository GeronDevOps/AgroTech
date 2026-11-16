'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Almacenamiento de fotos en Amazon S3 (AGRO-16 · diagrama de despliegue: bucket agrotech-imagenes).
 * Misma interfaz que el driver local: guardar(clave, buffer, tipo) · eliminar(clave) · urlPublica(clave, base).
 *
 * - Credenciales: en EC2 las toma el SDK del rol de la instancia (IMDSv2); nunca van en el .env.
 * - La app descarga las fotos directo del bucket por HTTPS (la API no las sirve): el bucket permite
 *   lectura pública solo del prefijo productos/ (infra/agrotech.yaml).
 * - Claves únicas por publicación → caché larga e inmutable en el teléfono (RNF-09, menos datos móviles).
 *
 * @param {{ bucket: string, region: string, urlBase: string, cliente?: { send: Function } }} opciones
 *   `cliente` permite inyectar un doble en las pruebas.
 */
function createAlmacenFotosS3({ bucket, region, urlBase, cliente }) {
  if (!bucket) throw new Error('FOTOS_S3_BUCKET es obligatorio con FOTOS_DRIVER=s3.');
  const s3 = cliente || new S3Client({ region, maxAttempts: 3 });
  const base = (urlBase || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/$/, '');

  const validar = (clave) => {
    if (typeof clave !== 'string' || !/^productos\/[\w-]+\/[\w-]+\.jpg$/.test(clave)) {
      throw new Error('Clave de foto inválida.');
    }
    return clave;
  };

  return {
    tipo: 's3',
    bucket,
    async guardar(clave, buffer, tipo = 'image/jpeg') {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: validar(clave),
        Body: buffer,
        ContentType: tipo,
        CacheControl: 'public, max-age=2592000, immutable',
        ServerSideEncryption: 'AES256',
      }));
    },
    async eliminar(clave) {
      // Borrar una clave que no existe no es error en S3 (igual que el driver local con force).
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: validar(clave) }));
    },
    // Con S3 la URL no depende del host de la petición: siempre la del bucket (o la de FOTOS_URL_BASE).
    urlPublica(clave) {
      return `${base}/${clave}`;
    },
  };
}

module.exports = { createAlmacenFotosS3 };
