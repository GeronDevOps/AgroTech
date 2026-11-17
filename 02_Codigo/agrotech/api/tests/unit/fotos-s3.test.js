'use strict';

const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createAlmacenFotosS3 } = require('../../src/almacenamiento/fotos-s3');
const { crearAlmacenFotos } = require('../../src/almacenamiento');

/** Doble del cliente S3: registra los comandos sin salir a la red. */
const clienteFalso = () => {
  const enviados = [];
  return { enviados, send: jest.fn(async (cmd) => { enviados.push(cmd); return {}; }) };
};
const CLAVE = 'productos/9b2f3c1e-1111-4111-8111-111111111111/0c8a7d2e-2222-4222-8222-222222222222.jpg';

describe('Driver de fotos en Amazon S3 (AGRO-16)', () => {
  test('guardar sube el JPEG cifrado, con su tipo y caché larga', async () => {
    const cliente = clienteFalso();
    const s3 = createAlmacenFotosS3({ bucket: 'agrotech-imagenes', region: 'us-east-1', cliente });
    const cuerpo = Buffer.from([0xff, 0xd8, 0xff]);
    await s3.guardar(CLAVE, cuerpo, 'image/jpeg');
    expect(cliente.enviados).toHaveLength(1);
    expect(cliente.enviados[0]).toBeInstanceOf(PutObjectCommand);
    expect(cliente.enviados[0].input).toEqual({
      Bucket: 'agrotech-imagenes', Key: CLAVE, Body: cuerpo, ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=2592000, immutable', ServerSideEncryption: 'AES256',
    });
  });

  test('eliminar borra exactamente la clave indicada (también la miniatura)', async () => {
    const cliente = clienteFalso();
    const s3 = createAlmacenFotosS3({ bucket: 'agrotech-imagenes', region: 'us-east-1', cliente });
    const minima = CLAVE.replace('.jpg', '_min.jpg');
    await s3.eliminar(minima);
    expect(cliente.enviados[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(cliente.enviados[0].input).toEqual({ Bucket: 'agrotech-imagenes', Key: minima });
  });

  test.each([
    ['fuera del prefijo productos/', 'usuarios/x/y.jpg'],
    ['con recorrido de rutas', 'productos/../secreto.jpg'],
    ['sin extensión .jpg', 'productos/a/b.png'],
    ['vacía', ''],
  ])('rechaza una clave %s sin llamar a S3', async (_c, clave) => {
    const cliente = clienteFalso();
    const s3 = createAlmacenFotosS3({ bucket: 'agrotech-imagenes', region: 'us-east-1', cliente });
    await expect(s3.guardar(clave, Buffer.alloc(1))).rejects.toThrow('Clave de foto inválida.');
    await expect(s3.eliminar(clave)).rejects.toThrow('Clave de foto inválida.');
    expect(cliente.send).not.toHaveBeenCalled();
  });

  test('la URL pública es la del bucket (o la de FOTOS_URL_BASE), sin depender del host de la petición', () => {
    const cliente = clienteFalso();
    expect(createAlmacenFotosS3({ bucket: 'agrotech-imagenes', region: 'us-east-1', cliente }).urlPublica(CLAVE, 'http://192.168.1.5:3000/fotos'))
      .toBe(`https://agrotech-imagenes.s3.us-east-1.amazonaws.com/${CLAVE}`);
    expect(createAlmacenFotosS3({ bucket: 'b', region: 'us-east-1', urlBase: 'https://fotos.agrotech.co/', cliente }).urlPublica(CLAVE))
      .toBe(`https://fotos.agrotech.co/${CLAVE}`);
  });

  test('sin bucket no arranca', () => {
    expect(() => createAlmacenFotosS3({ bucket: '', region: 'us-east-1' })).toThrow('FOTOS_S3_BUCKET');
  });

  test('crearAlmacenFotos elige el driver según FOTOS_DRIVER', () => {
    expect(crearAlmacenFotos({ driver: 'local', dir: '/tmp/x' }).tipo).toBe('local');
    expect(crearAlmacenFotos({ driver: 's3', s3Bucket: 'agrotech-imagenes', s3Region: 'us-east-1', urlBase: '' }).tipo).toBe('s3');
  });
});
