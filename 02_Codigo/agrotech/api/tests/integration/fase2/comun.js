'use strict';

const request = require('supertest');
const { pool } = require('../../../src/db/pool');
const { createApp } = require('../../../src/app');
const { createCorreo } = require('../../../src/modules/correo/correo');
const { crearAyudas } = require('../ayudas');

/**
 * Entorno común de las pruebas de integración de la Fase 2 del SRS (v1.1.0):
 * app con buzón de correo en memoria y ayudas para crear cuentas, productos y pedidos.
 */
function entornoFase2(extra = {}) {
  const correo = createCorreo({ driver: 'memoria' });
  const app = createApp({ pool, correo, ...extra });
  const ayudas = crearAyudas(app);
  const del = (token, ruta, cuerpo) => request(app).delete(`/api/v1${ruta}`).set('Authorization', `Bearer ${token}`).send(cuerpo || {});
  const publico = (metodo, ruta, cuerpo) => request(app)[metodo](`/api/v1${ruta}`).send(cuerpo || {});

  /** Cuenta de administrador: se registra como consumidor y el equipo le asigna el rol (como hace scripts/crear-admin.js). */
  async function administrador(nombre = 'Admin', telefono = '3009990000') {
    await ayudas.cuenta(nombre, 'CONSUMIDOR', telefono);
    await pool.query("UPDATE usuario SET rol = 'ADMINISTRADOR' WHERE telefono = $1", [telefono]);
    const r = await publico('post', '/auth/sesion', { identificador: telefono, contrasena: 'cosecha2026' });
    return { token: r.body.token, id: r.body.usuario.id };
  }

  /** Pedido de `cantidad` unidades del producto, confirmado por el consumidor. */
  async function pedido(tokenConsumidor, idProducto, cantidad = 1, extraBody = {}) {
    const r = await ayudas.confirmar(tokenConsumidor, require('node:crypto').randomUUID(), { items: [{ idProducto, cantidad }], ...extraBody });
    if (r.status !== 201) throw new Error(`pedido: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.pedidos[0];
  }

  const bitacora = async (accion) => (await pool.query('SELECT * FROM bitacora WHERE accion = $1 ORDER BY fecha', [accion])).rows;

  return { app, correo, ...ayudas, del, publico, administrador, pedido, bitacora, servicios: app.locals.servicios };
}

module.exports = { entornoFase2, pool };
