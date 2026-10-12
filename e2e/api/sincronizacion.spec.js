// CU-17 · Sincronización (caja negra sobre /sync/push y /sync/pull)
const { test, expect } = require('@playwright/test');
const {
  auth, uuid, json, crearCuenta, publicar,
} = require('../soporte/api');

const editar = (idEntidad, datos, idOperacion = uuid()) => ({ idOperacion, tipo: 'PRODUCTO.EDITAR', idEntidad, datos, creadoEn: new Date().toISOString() });

test.describe('CU-17 · Sincronización asíncrona', () => {
  test('CP-17: edición sin conexión con versión vieja → «Con error»; prevalece el servidor', { tag: '@CP-17' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const papa = await publicar(request, rosa.token, { precio: 85000, stock: 20 });
    expect(papa.version).toBe(1);

    // Otro teléfono de la productora cambia el precio mientras el primero está sin señal.
    const enLinea = await request.patch(`productos/${papa.id}`, { headers: auth(rosa.token), data: { precio: 95000, version: 1 } });
    expect(enLinea.status()).toBe(200);

    // Al reconectar, el teléfono sin señal envía su cola con la versión que conocía.
    const op = editar(papa.id, { precio: 80000, version: 1 });
    const r = await request.post('sync/push', { headers: auth(rosa.token), data: { operaciones: [op] } });
    expect(r.status()).toBe(200);
    const [resultado] = (await json(r)).resultados;
    expect(resultado).toMatchObject({
      idOperacion: op.idOperacion,
      resultado: 'CON_ERROR',
      error: { codigo: 'CONFLICTO_VERSION', detalles: { producto: { precio: 95000, version: 2 } } },
    });
    expect(typeof resultado.error.mensaje).toBe('string');

    // El servidor conserva su valor y el reenvío devuelve el mismo rechazo (idempotente).
    const vigente = (await json(await request.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto;
    expect(vigente).toMatchObject({ precio: 95000, version: 2 });
    const reenvio = (await json(await request.post('sync/push', { headers: auth(rosa.token), data: { operaciones: [op] } }))).resultados[0];
    expect(reenvio).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'CONFLICTO_VERSION' } });
  });

  test('RNF-03: una operación válida se aplica una sola vez aunque se reenvíe', { tag: '@CP-17' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const papa = await publicar(request, rosa.token, { stock: 20 });
    const op = editar(papa.id, { stock: 12, version: 1 });
    const enviar = () => request.post('sync/push', { headers: auth(rosa.token), data: { operaciones: [op] } });
    const [a, b] = await Promise.all([enviar(), enviar()]);
    const resultados = [(await json(a)).resultados[0].resultado, (await json(b)).resultados[0].resultado].sort();
    expect(resultados).toEqual(['PUBLICADO', 'YA_APLICADA']);
    expect((await json(await request.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto).toMatchObject({ stock: 12, version: 2 });
  });

  test('CU-17 paso 4: /sync/pull trae lo cambiado desde la última marca', { tag: '@CP-17' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const primera = await json(await request.get('sync/pull', { headers: auth(andres.token) }));
    expect(Date.parse(primera.servidorEn)).not.toBeNaN();
    const papa = await publicar(request, rosa.token, { nombre: 'Papa criolla', stock: 7 });
    const nueva = await json(await request.get(`sync/pull?desde=${encodeURIComponent(primera.servidorEn)}`, { headers: auth(andres.token) }));
    expect(nueva.productos.map((p) => p.id)).toContain(papa.id);
  });
});
