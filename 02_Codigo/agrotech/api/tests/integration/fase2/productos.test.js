'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { migrate } = require('../../../src/db/migrate');
const config = require('../../../src/config/env');
const { entornoFase2, pool } = require('./comun');

const e = entornoFase2();
let rosa; let luis; let andres;
const catalogo = async (token, q) => (await e.get(token, `/productos?${new URLSearchParams(q)}`)).body;
const nombres = (r) => r.productos.map((p) => p.nombre);

beforeAll(async () => { await migrate({ log: () => {} }); });
beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234', 'Pamplona');
  luis = await e.cuenta('Luis', 'PRODUCTOR', '3115551234', 'Ocaña');
  andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Pamplonita');
});
afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-10 · Pausar, reactivar y retirar (RF-10 · AGRO-24)', () => {
  test('CP-23: pausar oculta, reactivar la devuelve; retirar la deja inactiva conservando el histórico', async () => {
    const papa = await e.producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 10, municipio: 'Pamplona' });
    const pausa = await e.patch(rosa.token, `/productos/${papa.id}/estado`, { accion: 'PAUSAR', version: papa.version });
    expect(pausa.status).toBe(200);
    expect(pausa.body.producto.estado).toBe('PAUSADA');
    expect(nombres(await catalogo(andres.token, {}))).toEqual([]);
    expect((await e.get(andres.token, `/productos/${papa.id}`)).status).toBe(404);
    expect((await e.get(rosa.token, '/productos/mios')).body.productos[0].estado).toBe('PAUSADA');

    const reactivar = await e.patch(rosa.token, `/productos/${papa.id}/estado`, { accion: 'REACTIVAR', version: pausa.body.producto.version });
    expect(reactivar.body.producto.estado).toBe('ACTIVA');
    expect(nombres(await catalogo(andres.token, {}))).toEqual(['Papa pastusa']);

    const pedido = await e.pedido(andres.token, papa.id, 1);
    await e.entregar(rosa.token, pedido.id);
    const { body: { producto: vigente } } = await e.get(rosa.token, `/productos/${papa.id}`);
    const retirar = await e.patch(rosa.token, `/productos/${papa.id}/estado`, { accion: 'RETIRAR', version: vigente.version });
    expect(retirar.body.producto.estado).toBe('INACTIVA');
    expect((await e.get(rosa.token, '/productos/mios')).body.productos).toEqual([]);
    // Histórico: el pedido entregado sigue mostrando el producto.
    expect((await e.get(andres.token, `/pedidos/${pedido.id}`)).body.pedido.items[0].nombre).toBe('Papa pastusa');
    expect((await e.bitacora('PRODUCTO_RETIRAR'))).toHaveLength(1);
  });

  test('A1: con pedidos en curso se puede pausar pero no retirar', async () => {
    const papa = await e.producto(rosa.token, { nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 10, municipio: 'Pamplona' });
    await e.pedido(andres.token, papa.id, 1);
    let { body: { producto } } = await e.get(rosa.token, `/productos/${papa.id}`);
    const retirar = await e.patch(rosa.token, `/productos/${papa.id}/estado`, { accion: 'RETIRAR', version: producto.version });
    expect(retirar.status).toBe(409);
    expect(retirar.body.error).toMatchObject({ codigo: 'PEDIDOS_EN_CURSO', detalles: { pedidos: 1 } });
    const pausar = await e.patch(rosa.token, `/productos/${papa.id}/estado`, { accion: 'PAUSAR', version: producto.version });
    expect(pausar.status).toBe(200);
    ({ producto } = pausar.body);
    expect((await e.patch(rosa.token, `/productos/${papa.id}/estado`, { accion: 'PAUSAR', version: producto.version })).body.error.codigo).toBe('ESTADO_NO_PERMITIDO');
  });

  test('A3 + reactivar: sin cantidad la publicación vuelve como Agotada; versión vieja → CONFLICTO_VERSION', async () => {
    const mora = await e.producto(rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 3, municipio: 'Pamplona' });
    const pausa = (await e.patch(rosa.token, `/productos/${mora.id}/estado`, { accion: 'PAUSAR', version: mora.version })).body.producto;
    const cero = (await e.patch(rosa.token, `/productos/${mora.id}`, { stock: 0, version: pausa.version })).body.producto;
    expect(cero.estado).toBe('PAUSADA'); // una pausada no se reactiva sola
    expect((await e.patch(rosa.token, `/productos/${mora.id}/estado`, { accion: 'REACTIVAR', version: pausa.version })).body.error.codigo).toBe('CONFLICTO_VERSION');
    const r = await e.patch(rosa.token, `/productos/${mora.id}/estado`, { accion: 'REACTIVAR', version: cero.version });
    expect(r.body.producto.estado).toBe('AGOTADA');
  });

  test('editar nombre y descripción; el consumidor no puede cambiar estados', async () => {
    const mora = await e.producto(rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 3, municipio: 'Pamplona' });
    const r = await e.patch(rosa.token, `/productos/${mora.id}`, { nombre: 'Mora de castilla', descripcion: 'Recién cosechada', version: mora.version });
    expect(r.body.producto).toMatchObject({ nombre: 'Mora de castilla', descripcion: 'Recién cosechada', precio: 4500 });
    expect((await e.patch(andres.token, `/productos/${mora.id}/estado`, { accion: 'PAUSAR', version: 1 })).status).toBe(403);
  });

  test('A4 sin señal: PRODUCTO.ESTADO por /sync/push', async () => {
    const mora = await e.producto(rosa.token, { nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 3, municipio: 'Pamplona' });
    const r = await e.post(rosa.token, '/sync/push', { operaciones: [{ idOperacion: crypto.randomUUID(), tipo: 'PRODUCTO.ESTADO', idEntidad: mora.id, datos: { accion: 'PAUSAR', version: mora.version } }] });
    expect(r.body.resultados[0]).toMatchObject({ resultado: 'PUBLICADO', producto: { estado: 'PAUSADA' } });
  });
});

describe('CU-11 · Buscar y ordenar (RF-11 · AGRO-25)', () => {
  beforeEach(async () => {
    await e.producto(rosa.token, { nombre: 'Café pergamino', descripcion: 'Café especial de altura', categoria: 'CAFE_CACAO', unidad: 'arroba', precio: 120000, stock: 5, municipio: 'Pamplona' });
    await e.producto(rosa.token, { nombre: 'Papa criolla', categoria: 'TUBERCULOS', unidad: 'kg', precio: 3000, stock: 50, municipio: 'Pamplona' });
    await e.producto(luis.token, { nombre: 'Cebolla ocañera', descripcion: 'Cebolla roja para el café de la tarde', categoria: 'HORTALIZAS', unidad: 'kg', precio: 2500, stock: 80, municipio: 'Ocaña' });
  });

  test('CP-24: busca en nombre y descripción sin distinguir mayúsculas ni tildes', async () => {
    expect(nombres(await catalogo(andres.token, { q: 'CAFE' })).sort()).toEqual(['Café pergamino', 'Cebolla ocañera']);
    expect(nombres(await catalogo(andres.token, { q: 'ocanera' }))).toEqual(['Cebolla ocañera']);
    // Los filtros se conservan al buscar.
    expect(nombres(await catalogo(andres.token, { q: 'cafe', municipio: 'Pamplona' }))).toEqual(['Café pergamino']);
    expect((await e.get(andres.token, '/productos?q=ca')).body.error.detalles.campos).toHaveProperty('q');
  });

  test('ordena por precio (asc/desc), fecha y calificación', async () => {
    expect(nombres(await catalogo(andres.token, { orden: 'precio_asc' }))).toEqual(['Cebolla ocañera', 'Papa criolla', 'Café pergamino']);
    expect(nombres(await catalogo(andres.token, { orden: 'precio_desc' }))).toEqual(['Café pergamino', 'Papa criolla', 'Cebolla ocañera']);
    expect(nombres(await catalogo(andres.token, { orden: 'recientes' }))[0]).toBe('Cebolla ocañera');
    // Luis tiene 5 estrellas; Rosa no tiene calificaciones.
    const cebolla = (await catalogo(andres.token, { q: 'cebolla' })).productos[0];
    const p = await e.pedido(andres.token, cebolla.id, 1);
    await e.entregar(luis.token, p.id);
    await e.post(andres.token, `/pedidos/${p.id}/calificacion`, { puntuacion: 5 });
    expect(nombres(await catalogo(andres.token, { orden: 'calificacion' }))[0]).toBe('Cebolla ocañera');
    expect((await e.get(andres.token, '/productos?orden=alfabetico')).status).toBe(400);
  });

  test('A1: sin coincidencias sugiere las categorías frecuentes', async () => {
    const r = await catalogo(andres.token, { q: 'aguacate' });
    expect(r.total).toBe(0);
    expect(r.sugerencias).toEqual(expect.arrayContaining(['HORTALIZAS', 'TUBERCULOS', 'CAFE_CACAO']));
  });
});

describe('CU-12 · Ordenar por cercanía (RF-12 · AGRO-25)', () => {
  beforeEach(async () => {
    await e.producto(luis.token, { nombre: 'Cebolla ocañera', categoria: 'HORTALIZAS', unidad: 'kg', precio: 2500, stock: 80, municipio: 'Ocaña' });
    await e.producto(rosa.token, { nombre: 'Papa criolla', categoria: 'TUBERCULOS', unidad: 'kg', precio: 3000, stock: 50, municipio: 'Pamplona' });
  });

  test('CP-25: con la ubicación del perfil (Pamplonita) ordena de menor a mayor distancia', async () => {
    const r = await catalogo(andres.token, { orden: 'cercania' });
    expect(nombres(r)).toEqual(['Papa criolla', 'Cebolla ocañera']);
    expect(r.ubicacion).toMatchObject({ origen: 'PERFIL', municipio: 'Pamplonita' });
    expect(r.productos[0].distanciaKm).toBeLessThan(15);
    expect(r.productos[1].distanciaKm).toBeGreaterThan(100);
  });

  test('con la ubicación del teléfono (Ocaña) cambia el orden; el radio filtra y propone ampliarlo (A2)', async () => {
    const ocana = { lat: 8.24, lon: -73.35 };
    const r = await catalogo(andres.token, { orden: 'cercania', ...ocana });
    expect(nombres(r)).toEqual(['Cebolla ocañera', 'Papa criolla']);
    expect(r.ubicacion.origen).toBe('TELEFONO');
    expect(nombres(await catalogo(andres.token, { orden: 'cercania', radioKm: 20, ...ocana }))).toEqual(['Cebolla ocañera']);
    const lejos = await catalogo(andres.token, { orden: 'cercania', radioKm: 5, lat: 7.0, lon: -72.2 });
    expect(lejos.total).toBe(0);
    expect(lejos.ampliarRadio).toEqual({ radioActualKm: 5, sugeridoKm: 10 });
  });
});
