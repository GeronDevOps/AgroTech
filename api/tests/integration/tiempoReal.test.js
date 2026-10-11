'use strict';

const fs = require('node:fs/promises');
const http = require('node:http');
const crypto = require('node:crypto');
const WebSocket = require('ws');
const { pool } = require('../../src/db/pool');
const { migrate } = require('../../src/db/migrate');
const { createApp } = require('../../src/app');
const config = require('../../src/config/env');
const { createServidorTiempoReal, CIERRE } = require('../../src/tiempo-real/servidorWs');
const { crearAyudas } = require('./ayudas');

const app = createApp({ pool });
const { cuenta, producto, confirmar, patch, post, hasta } = crearAyudas(app);
const uuid = () => crypto.randomUUID();

let server; let tiempoReal; let url;
let rosa; let andres; let maria; let papa;
const abiertos = [];

/** Cliente de prueba: guarda todo lo que recibe. */
function conectar(token, { autenticar = true } = {}) {
  const ws = new WebSocket(url);
  abiertos.push(ws);
  ws.recibidos = [];
  ws.cierre = new Promise((resolve) => ws.on('close', (codigo) => resolve(codigo)));
  ws.on('message', (d) => ws.recibidos.push(JSON.parse(d.toString())));
  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      if (!autenticar) return resolve(ws);
      ws.send(JSON.stringify({ tipo: 'autenticar', token }));
      return hasta(async () => ws.recibidos.some((m) => m.tipo === 'listo')).then(() => resolve(ws), reject);
    });
    ws.on('error', reject);
  });
}
const de = (ws, tipo) => ws.recibidos.filter((m) => m.tipo === tipo);

beforeAll(async () => {
  await migrate({ log: () => {} });
  server = http.createServer(app);
  const { eventos, tokens } = app.locals.servicios;
  tiempoReal = createServidorTiempoReal({ server, pool, tokens, eventos, plazoAutenticacionMs: 300 });
  await new Promise((r) => server.listen(0, r));
  url = `ws://127.0.0.1:${server.address().port}/ws`;
});

beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  rosa = await cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  maria = await cuenta('Maria', 'CONSUMIDOR', '3205551111', 'Cúcuta');
  papa = await producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
});

afterEach(() => { while (abiertos.length) abiertos.pop().terminate(); });

afterAll(async () => {
  await tiempoReal.cerrar();
  await new Promise((r) => server.close(r));
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('Servidor WebSocket (tiempo real · Entrega 3)', () => {
  test('CA-06: el productor conectado recibe el pedido nuevo en tiempo real', async () => {
    const wsRosa = await conectar(rosa.token);
    const [pedido] = (await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] })).body.pedidos;
    await hasta(async () => de(wsRosa, 'pedido_nuevo').length === 1);
    expect(de(wsRosa, 'pedido_nuevo')[0]).toEqual({ tipo: 'pedido_nuevo', idPedido: pedido.id });
  });

  test('CA-08: cada cambio de estado llega a ambas partes y a nadie más', async () => {
    const [wsRosa, wsAndres, wsMaria] = await Promise.all([conectar(rosa.token), conectar(andres.token), conectar(maria.token)]);
    const [pedido] = (await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] })).body.pedidos;
    await patch(rosa.token, `/pedidos/${pedido.id}/estado`, { estado: 'ACEPTADO', version: pedido.version });
    await hasta(async () => de(wsAndres, 'pedido_actualizado').length === 1 && de(wsRosa, 'pedido_actualizado').length === 1);
    expect(de(wsAndres, 'pedido_actualizado')[0]).toEqual({ tipo: 'pedido_actualizado', idPedido: pedido.id, estado: 'ACEPTADO' });
    await new Promise((r) => setTimeout(r, 100));
    expect(wsMaria.recibidos.filter((m) => m.tipo !== 'listo')).toEqual([]);
  });

  test('CA-09: el mensaje llega al otro teléfono; al leerlo, el emisor ve "leído"', async () => {
    const [wsRosa, wsAndres] = await Promise.all([conectar(rosa.token), conectar(andres.token)]);
    const [pedido] = (await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] })).body.pedidos;
    const id = uuid();
    await post(andres.token, `/pedidos/${pedido.id}/mensajes`, { id, contenido: '¿Llega hoy?' });
    await hasta(async () => de(wsRosa, 'mensaje').length === 1);
    expect(de(wsRosa, 'mensaje')[0].mensaje).toMatchObject({ id, idPedido: pedido.id, idEmisor: andres.id, contenido: '¿Llega hoy?' });

    await post(rosa.token, `/pedidos/${pedido.id}/mensajes/leidos`);
    await hasta(async () => de(wsAndres, 'mensajes_leidos').length === 1);
    expect(de(wsAndres, 'mensajes_leidos')[0]).toEqual({ tipo: 'mensajes_leidos', idPedido: pedido.id, idLector: rosa.id, ids: [id] });
  });

  test('el mismo usuario con dos teléfonos recibe en ambos', async () => {
    const [a, b] = await Promise.all([conectar(rosa.token), conectar(rosa.token)]);
    expect(tiempoReal.conectados()).toBeGreaterThanOrEqual(2);
    await confirmar(andres.token, uuid(), { items: [{ idProducto: papa.id, cantidad: 1 }] });
    await hasta(async () => de(a, 'pedido_nuevo').length === 1 && de(b, 'pedido_nuevo').length === 1);
  });

  test('RNF-04: sin autenticarse a tiempo o con token inválido se cierra la conexión', async () => {
    const callado = await conectar(null, { autenticar: false });
    expect(await callado.cierre).toBe(CIERRE.SIN_AUTENTICAR);
    const falso = await conectar(null, { autenticar: false });
    falso.send(JSON.stringify({ tipo: 'autenticar', token: 'no-es-un-jwt' }));
    expect(await falso.cierre).toBe(CIERRE.TOKEN_INVALIDO);
  });
});
