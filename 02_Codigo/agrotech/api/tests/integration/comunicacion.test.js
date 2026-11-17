'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { crearAyudas } = require('./ayudas');
const { vaciarUsuarios } = require('./limpiar');

const app = createApp({ pool });
const { cuenta, producto, confirmar, get, post, entregar } = crearAyudas(app);
const uuid = () => crypto.randomUUID();
const mensaje = (token, idPedido, contenido, id = uuid()) => post(token, `/pedidos/${idPedido}/mensajes`, { id, contenido });

let rosa; let luis; let andres; let maria; let papa; let pedido;

beforeAll(async () => { await migrate({ log: () => {} }); });

beforeEach(async () => {
  await vaciarUsuarios(pool);
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  luis = await cuenta('Luis', 'PRODUCTOR', '3105559999', 'Ocaña');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  maria = await cuenta('Maria', 'CONSUMIDOR', '3205551111', 'Cúcuta');
  papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
  [pedido] = (await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 2 }] })).body.pedidos;
});

afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-05 · Chat por pedido (AGRO-11)', () => {
  test('CA-09: ambas partes ven el mismo historial, en orden y con su hora', async () => {
    expect((await mensaje(andres.token, pedido.id, '  ¿Puede entregar a las 9?  ')).status).toBe(201);
    expect((await mensaje(rosa.token, pedido.id, 'Sí, en el parque.')).status).toBe(201);
    const deAndres = await get(andres.token, `/pedidos/${pedido.id}/mensajes`);
    const deRosa = await get(rosa.token, `/pedidos/${pedido.id}/mensajes`);
    expect(deAndres.status).toBe(200);
    expect(deAndres.body).toEqual(deRosa.body);
    expect(deAndres.body.abierto).toBe(true);
    expect(deAndres.body.mensajes.map((m) => [m.idEmisor, m.contenido])).toEqual([[andres.id, '¿Puede entregar a las 9?'], [rosa.id, 'Sí, en el parque.']]);
    expect(Date.parse(deAndres.body.mensajes[0].fecha)).not.toBeNaN();
  });

  test('CU-05 A1: el reenvío con el mismo id no duplica (200); otro usuario no puede reutilizarlo', async () => {
    const id = uuid();
    expect((await mensaje(andres.token, pedido.id, 'Hola', id)).status).toBe(201);
    const otra = await mensaje(andres.token, pedido.id, 'Hola', id);
    expect(otra.status).toBe(200);
    expect(otra.body.mensaje.id).toBe(id);
    expect((await mensaje(rosa.token, pedido.id, 'Hola', id)).body.error.codigo).toBe('ID_EN_USO');
    expect((await get(andres.token, `/pedidos/${pedido.id}/mensajes`)).body.mensajes).toHaveLength(1);
  });

  test.each([
    ['vacío', '   '],
    ['más de 500 caracteres', 'a'.repeat(501)],
  ])('CU-05 A3: mensaje %s no se envía', async (_c, contenido) => {
    const r = await mensaje(andres.token, pedido.id, contenido);
    expect(r.status).toBe(400);
    expect(r.body.error.detalles.campos.contenido).toBeTruthy();
  });

  test('solo las partes del pedido pueden leer o escribir (404 para los demás)', async () => {
    expect((await mensaje(maria.token, pedido.id, 'Hola')).status).toBe(404);
    expect((await get(luis.token, `/pedidos/${pedido.id}/mensajes`)).status).toBe(404);
  });

  test('CU-05 A2: con el pedido entregado el chat queda en solo lectura', async () => {
    await mensaje(andres.token, pedido.id, 'Gracias');
    await entregar(rosa.token, pedido.id);
    const r = await mensaje(andres.token, pedido.id, 'Otra cosa');
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('CHAT_CERRADO');
    const historial = await get(andres.token, `/pedidos/${pedido.id}/mensajes`);
    expect(historial.body).toMatchObject({ abierto: false, estadoPedido: 'ENTREGADO' });
    expect(historial.body.mensajes).toHaveLength(1);
  });

  test('CU-05 paso 4: los no leídos se cuentan por pedido y se marcan al abrir la conversación', async () => {
    await mensaje(andres.token, pedido.id, 'Uno');
    await mensaje(andres.token, pedido.id, 'Dos');
    await mensaje(rosa.token, pedido.id, 'Respuesta');
    const lista = await get(rosa.token, '/pedidos');
    expect(lista.body.pedidos[0].mensajesSinLeer).toBe(2);
    expect((await get(andres.token, `/pedidos/${pedido.id}`)).body.pedido.mensajesSinLeer).toBe(1);

    expect((await post(rosa.token, `/pedidos/${pedido.id}/mensajes/leidos`)).body).toEqual({ leidos: 2 });
    expect((await get(rosa.token, '/pedidos')).body.pedidos[0].mensajesSinLeer).toBe(0);
    const { mensajes } = (await get(andres.token, `/pedidos/${pedido.id}/mensajes`)).body;
    expect(mensajes.map((m) => m.leido)).toEqual([true, true, false]); // el propio de Rosa sigue sin leer por Andrés
    expect(Date.parse(mensajes[0].leidoEn)).not.toBeNaN();
  });

  test('"despuesDe" trae solo los mensajes nuevos', async () => {
    const primero = (await mensaje(andres.token, pedido.id, 'Uno')).body.mensaje;
    await mensaje(rosa.token, pedido.id, 'Dos');
    const r = await get(andres.token, `/pedidos/${pedido.id}/mensajes?despuesDe=${encodeURIComponent(primero.fecha)}`);
    expect(r.body.mensajes.map((m) => m.contenido)).toEqual(['Dos']);
  });

  test('bandeja de conversaciones: actividad más reciente primero, con no leídos y contraparte', async () => {
    const cebolla = await producto(luis.token, { nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, stock: 40, municipio: 'Ocaña' });
    const [otro] = (await confirmar(andres.token, uuid(), { items: [{ idProducto: cebolla.id, cantidad: 1 }] })).body.pedidos;
    await mensaje(luis.token, otro.id, '¿A qué hora?');
    await mensaje(rosa.token, pedido.id, 'Listo para mañana');
    const r = await get(andres.token, '/mensajes');
    expect(r.body.conversaciones.map((c) => [c.idPedido, c.contraparte, c.sinLeer, c.ultimoMensaje.contenido])).toEqual([
      [pedido.id, 'Rosa P.', 1, 'Listo para mañana'],
      [otro.id, 'Luis P.', 1, '¿A qué hora?'],
    ]);
  });

  test('CU-05 A1 sin señal: MENSAJE.CREAR por /sync/push; el reenvío responde YA_APLICADA', async () => {
    const op = { idOperacion: uuid(), tipo: 'MENSAJE.CREAR', idEntidad: uuid(), datos: { idPedido: pedido.id, contenido: 'Escrito sin señal' } };
    const r1 = await post(andres.token, '/sync/push', { operaciones: [op] });
    expect(r1.body.resultados[0]).toMatchObject({ resultado: 'PUBLICADO', mensaje: { id: op.idEntidad, contenido: 'Escrito sin señal' } });
    expect(r1.body.resultados[0].alConfirmar).toBeUndefined();
    expect((await post(andres.token, '/sync/push', { operaciones: [op] })).body.resultados[0].resultado).toBe('YA_APLICADA');
    await entregar(rosa.token, pedido.id);
    const tarde = { ...op, idOperacion: uuid(), idEntidad: uuid() };
    expect((await post(andres.token, '/sync/push', { operaciones: [tarde] })).body.resultados[0]).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'CHAT_CERRADO' } });
  });
});

describe('CU-06 · Calificar al productor (AGRO-12)', () => {
  const calificar = (token, idPedido, cuerpo) => post(token, `/pedidos/${idPedido}/calificacion`, cuerpo);

  test('CU-06 A1: un pedido no entregado no se puede calificar', async () => {
    const r = await calificar(andres.token, pedido.id, { puntuacion: 5 });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('PEDIDO_NO_ENTREGADO');
  });

  test('CA-10: una sola calificación por pedido y el promedio del productor se actualiza', async () => {
    await entregar(rosa.token, pedido.id);
    const r = await calificar(andres.token, pedido.id, { puntuacion: 4, comentario: '  Buena papa,   bien empacada ' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ calificacion: { puntuacion: 4, comentario: 'Buena papa, bien empacada' }, reputacion: { promedio: 4, total: 1 } });

    const otra = await calificar(andres.token, pedido.id, { puntuacion: 1 });
    expect(otra.status).toBe(409);
    expect(otra.body.error).toMatchObject({ codigo: 'YA_CALIFICADO', detalles: { calificacion: { puntuacion: 4 } } });

    // Segundo pedido entregado, otra calificación: promedio (4 + 5) / 2.
    const [p2] = (await confirmar(maria.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] })).body.pedidos;
    await entregar(rosa.token, p2.id);
    expect((await calificar(maria.token, p2.id, { puntuacion: 5 })).body.reputacion).toEqual({ promedio: 4.5, total: 2 });

    // CU-06 paso 4: visible en el catálogo y en el perfil del productor.
    expect((await get(maria.token, `/productos/${papa.id}`)).body.producto.productor.calificacion).toEqual({ promedio: 4.5, total: 2 });
    const perfil = await get(maria.token, `/productores/${rosa.id}/calificaciones`);
    expect(perfil.body).toMatchObject({ productor: { id: rosa.id, nombre: 'Rosa P.' }, reputacion: { promedio: 4.5, total: 2 }, hayMas: false });
    expect(perfil.body.calificaciones.map((c) => [c.puntuacion, c.consumidor])).toEqual([[5, 'Maria P.'], [4, 'Andres P.']]);

    // A2: el pedido muestra la calificación en solo lectura.
    expect((await get(andres.token, `/pedidos/${pedido.id}`)).body.pedido.calificacion).toMatchObject({ puntuacion: 4 });
  });

  test.each([
    ['puntuación 0', { puntuacion: 0 }],
    ['puntuación 6', { puntuacion: 6 }],
    ['puntuación decimal', { puntuacion: 4.5 }],
    ['comentario de 301 caracteres', { puntuacion: 3, comentario: 'x'.repeat(301) }],
  ])('400 con %s', async (_c, cuerpo) => {
    await entregar(rosa.token, pedido.id);
    expect((await calificar(andres.token, pedido.id, cuerpo)).status).toBe(400);
  });

  test('solo califica el consumidor del pedido', async () => {
    await entregar(rosa.token, pedido.id);
    expect((await calificar(maria.token, pedido.id, { puntuacion: 5 })).status).toBe(404);
    expect((await calificar(rosa.token, pedido.id, { puntuacion: 5 })).status).toBe(403);
  });

  test('CU-06 A3 sin señal: CALIFICACION.CREAR por /sync/push', async () => {
    await entregar(rosa.token, pedido.id);
    const op = { idOperacion: uuid(), tipo: 'CALIFICACION.CREAR', idEntidad: pedido.id, datos: { puntuacion: 5, comentario: 'Excelente' } };
    const r = await post(andres.token, '/sync/push', { operaciones: [op] });
    expect(r.body.resultados[0]).toMatchObject({ resultado: 'PUBLICADO', calificacion: { puntuacion: 5 }, reputacion: { promedio: 5, total: 1 } });
    const segunda = { ...op, idOperacion: uuid() };
    expect((await post(andres.token, '/sync/push', { operaciones: [segunda] })).body.resultados[0]).toMatchObject({ resultado: 'CON_ERROR', error: { codigo: 'YA_CALIFICADO' } });
  });

  test('404 para un productor inexistente', async () => {
    expect((await get(andres.token, `/productores/${uuid()}/calificaciones`)).status).toBe(404);
    expect((await get(andres.token, `/productores/${andres.id}/calificaciones`)).status).toBe(404);
  });
});

describe('Dispositivos para push (AGRO-20 · CU-16 paso 1)', () => {
  const TOKEN = 'fcm-token-de-prueba-0123456789:APA91b_x';
  const dispositivo = async (token) => (await pool.query('SELECT id_usuario, estado FROM dispositivo WHERE token = $1', [token])).rows[0];

  test('registra el token; si otra cuenta inicia sesión en el teléfono, se reasigna', async () => {
    expect((await post(rosa.token, '/dispositivos', { token: TOKEN })).status).toBe(201);
    expect(await dispositivo(TOKEN)).toEqual({ id_usuario: rosa.id, estado: 'VIGENTE' });
    expect((await post(rosa.token, '/dispositivos', { token: TOKEN })).status).toBe(200);
    await post(luis.token, '/dispositivos', { token: TOKEN });
    expect((await dispositivo(TOKEN)).id_usuario).toBe(luis.id);
  });

  test('al cerrar sesión se invalida (solo el dueño)', async () => {
    await post(rosa.token, '/dispositivos', { token: TOKEN });
    const del = (t) => require('supertest')(app).delete(`/api/v1/dispositivos/${encodeURIComponent(TOKEN)}`).set('Authorization', `Bearer ${t}`);
    expect((await del(luis.token)).status).toBe(204);
    expect((await dispositivo(TOKEN)).estado).toBe('VIGENTE');
    await del(rosa.token);
    expect((await dispositivo(TOKEN)).estado).toBe('INVALIDO');
  });

  test('400 con token o plataforma inválidos', async () => {
    expect((await post(rosa.token, '/dispositivos', { token: 'corto' })).status).toBe(400);
    expect((await post(rosa.token, '/dispositivos', { token: TOKEN, plataforma: 'IOS' })).status).toBe(400);
  });
});
