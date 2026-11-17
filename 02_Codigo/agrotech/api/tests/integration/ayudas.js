'use strict';

const crypto = require('node:crypto');
const request = require('supertest');

/** Utilidades compartidas por las pruebas de integración de pedidos y pagos. */

const jpeg = (bytes = 2048) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes - 4, 1)]);

function crearAyudas(app) {
  async function cuenta(nombre, rol, telefono, municipio = 'Pamplonita') {
    const res = await request(app).post('/api/v1/auth/registro').send({
      nombres: nombre, apellidos: 'Prueba', correo: `${nombre.toLowerCase()}@correo.co`, telefono,
      contrasena: 'cosecha2026', rol, municipio, aceptaTratamientoDatos: true,
    });
    if (res.status !== 201) throw new Error(`registro ${nombre}: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.token, id: res.body.usuario.id };
  }

  async function producto(token, datos) {
    const res = await request(app).post('/api/v1/productos').set('Authorization', `Bearer ${token}`)
      .field('datos', JSON.stringify({ id: crypto.randomUUID(), municipio: 'Pamplonita', ...datos }))
      .attach('foto', jpeg(), { filename: 'f.jpg', contentType: 'image/jpeg' })
      .attach('miniatura', jpeg(512), { filename: 'm.jpg', contentType: 'image/jpeg' });
    if (res.status !== 201) throw new Error(`producto: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.producto;
  }

  const confirmar = (token, clave, body) => {
    const r = request(app).post('/api/v1/pedidos').set('Authorization', `Bearer ${token}`);
    if (clave) r.set('Idempotency-Key', clave);
    return r.send({ puntoEntrega: 'Parque principal de Pamplonita', franjaEntrega: 'MANANA', ...body });
  };
  const get = (token, ruta) => request(app).get(`/api/v1${ruta}`).set('Authorization', `Bearer ${token}`);
  const patch = (token, ruta, cuerpo) => request(app).patch(`/api/v1${ruta}`).set('Authorization', `Bearer ${token}`).send(cuerpo);
  const post = (token, ruta, cuerpo) => request(app).post(`/api/v1${ruta}`).set('Authorization', `Bearer ${token}`).send(cuerpo || {});

  /** Lleva un pedido hasta ENTREGADO como lo haría el productor (CU-13). */
  async function entregar(tokenProductor, idPedido) {
    let version;
    ({ body: { pedido: { version } } } = await get(tokenProductor, `/pedidos/${idPedido}`));
    for (const estado of ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO']) {
      const r = await patch(tokenProductor, `/pedidos/${idPedido}/estado`, { estado, version });
      if (r.status !== 200) throw new Error(`entregar ${estado}: ${r.status} ${JSON.stringify(r.body)}`);
      ({ version } = r.body.pedido);
    }
  }

  /** Espera a que una condición asíncrona se cumpla (eventos que se procesan después de responder). */
  async function hasta(condicion, ms = 3000) {
    const fin = Date.now() + ms;
    while (!(await condicion())) {
      if (Date.now() > fin) throw new Error('La condición no se cumplió a tiempo');
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  return { cuenta, producto, confirmar, get, patch, post, entregar, hasta };
}

/** Evento «transaction.updated» firmado como lo hace Wompi (docs.wompi.co → Eventos). */
function eventoWompi({ id = `tx-${crypto.randomUUID()}`, status, reference, amount, secreto, environment = 'test', timestamp = 1760000000, metodo = 'CARD' }) {
  const data = { transaction: { id, status, reference, amount_in_cents: amount, payment_method_type: metodo, currency: 'COP' } };
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const valores = [id, status, amount].join('');
  const checksum = crypto.createHash('sha256').update(`${valores}${timestamp}${secreto}`).digest('hex').toUpperCase();
  return { event: 'transaction.updated', data, environment, signature: { properties, checksum }, timestamp, sent_at: new Date().toISOString() };
}

module.exports = { crearAyudas, eventoWompi, jpeg };
