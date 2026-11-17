/**
 * Ayudas de caja negra: hablan con la API solo por HTTP y WebSocket, como lo haría la app.
 * Cada llamada crea datos propios (usuarios con teléfono y correo únicos), así las pruebas
 * no dependen de una base vacía y se pueden ejecutar contra un servidor desplegado.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { expect } = require('@playwright/test');
const { API, BUZON, ADMIN } = require('../entorno');

const CONTRASENA = 'cosecha2026';
const FOTOS = path.resolve(__dirname, '../fixtures');
const foto = (nombre) => ({ name: `${nombre}.jpg`, mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(FOTOS, `${nombre}.jpg`)) });
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const uuid = () => crypto.randomUUID();
const unico = () => `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const telefonoUnico = () => `3${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;

async function json(respuesta) {
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}

/** Registra una cuenta nueva (CU-01) y devuelve { token, usuario, correo, telefono }. */
async function crearCuenta(request, { rol = 'CONSUMIDOR', municipio = 'Pamplona', nombres } = {}) {
  for (let intento = 0; intento < 3; intento += 1) {
    const correo = `e2e.${unico()}@agrotech.test`;
    const telefono = telefonoUnico();
    const r = await request.post('auth/registro', {
      data: {
        nombres: nombres || (rol === 'PRODUCTOR' ? 'Productora' : 'Comprador'), apellidos: 'Prueba', correo, telefono,
        contrasena: CONTRASENA, rol, municipio, aceptaTratamientoDatos: true,
      },
    });
    if (r.status() === 409) continue; // teléfono repetido por azar
    expect(r.status(), await r.text()).toBe(201);
    const b = await json(r);
    return { token: b.token, usuario: b.usuario, correo, telefono };
  }
  throw new Error('No se pudo crear una cuenta única');
}

/** Publica un producto (CU-02) con foto y miniatura reales. */
async function publicar(request, token, datos = {}, imagen = 'papa') {
  const r = await request.post('productos', {
    headers: auth(token),
    multipart: {
      datos: JSON.stringify({ id: uuid(), nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20, municipio: 'Pamplona', ...datos }),
      foto: foto(imagen),
      miniatura: foto(`${imagen}_min`),
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await json(r)).producto;
}

/** Confirma un pedido (CU-04) con su clave de idempotencia. */
function pedir(request, token, items, { clave = uuid(), metodoPago } = {}) {
  return request.post('pedidos', {
    headers: { ...auth(token), 'Idempotency-Key': clave },
    data: { items, puntoEntrega: 'Parque principal', franjaEntrega: 'MANANA', ...(metodoPago ? { metodoPago } : {}) },
  });
}

async function cambiarEstado(request, tokenProductor, pedido, estado, extra = {}) {
  return request.patch(`pedidos/${pedido.id}/estado`, { headers: auth(tokenProductor), data: { estado, version: pedido.version, ...extra } });
}

/** Lleva un pedido hasta ENTREGADO (CU-13) y lo devuelve actualizado. */
async function entregar(request, tokenProductor, pedido) {
  let p = pedido;
  for (const estado of ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO']) {
    const r = await cambiarEstado(request, tokenProductor, p, estado);
    expect(r.status(), await r.text()).toBe(200);
    p = (await json(r)).pedido;
  }
  return p;
}

/** Evento de Wompi firmado: SHA256(valores de signature.properties + timestamp + secreto de eventos). */
function eventoWompi({ status, reference, amount, secreto, id = `tx-${uuid()}`, timestamp = Math.floor(Date.now() / 1000) }) {
  const checksum = crypto.createHash('sha256').update(`${id}${status}${amount}${timestamp}${secreto}`).digest('hex');
  return {
    event: 'transaction.updated', environment: 'test', timestamp, sent_at: new Date().toISOString(),
    data: { transaction: { id, status, reference, amount_in_cents: amount, payment_method_type: 'CARD', currency: 'COP' } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum },
  };
}

/** Cliente WebSocket autenticado que guarda lo que recibe, con la hora de llegada. */
function conectarWs(token) {
  const url = `${API.replace(/^http/, 'ws')}/ws`;
  const ws = new WebSocket(url);
  ws.recibidos = [];
  ws.on('message', (d) => ws.recibidos.push({ ...JSON.parse(d.toString()), recibidoEn: Date.now() }));
  return new Promise((resolve, reject) => {
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ tipo: 'autenticar', token })));
    const espera = setInterval(() => {
      if (ws.recibidos.some((m) => m.tipo === 'listo')) { clearInterval(espera); resolve(ws); }
    }, 20);
    setTimeout(() => { clearInterval(espera); reject(new Error('WebSocket sin respuesta')); }, 10_000);
  });
}

/** Percentil p (0–100) de una lista de números. */
const percentil = (valores, p) => {
  const o = [...valores].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)];
};

/** CP-20: último código de recuperación enviado a `correo` (buzón del driver "archivo" de la API local). */
async function codigoRecuperacion(correo, { desde = 0, ms = 10_000 } = {}) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const archivos = fs.existsSync(BUZON) ? fs.readdirSync(BUZON).filter((f) => f.endsWith('.json')) : [];
    const mios = archivos
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(BUZON, f), 'utf8')); } catch { return null; } }) // archivo de otra prueba aún en escritura
      .filter((m) => m && m.para === correo && Date.parse(m.fecha) >= desde && /: (\d{6})$/.test(m.asunto))
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
    if (mios.length) return /: (\d{6})$/.exec(mios[0].asunto)[1];
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No llegó el código de recuperación a ${correo}`);
}

/** CP-30: sesión del administrador de pruebas. */
async function entrarAdmin(request) {
  const r = await request.post('auth/sesion', { data: { identificador: ADMIN.correo, contrasena: ADMIN.contrasena } });
  expect(r.status(), 'Ejecute "npm run preparar" para crear el administrador de pruebas').toBe(200);
  const b = await json(r);
  return { token: b.token, usuario: b.usuario };
}

/** Lleva un pedido a ACEPTADO (CU-13) y lo devuelve actualizado. */
async function aceptar(request, tokenProductor, pedido) {
  const r = await cambiarEstado(request, tokenProductor, pedido, 'ACEPTADO');
  expect(r.status(), await r.text()).toBe(200);
  return (await json(r)).pedido;
}

module.exports = {
  codigoRecuperacion, entrarAdmin, aceptar, BUZON, ADMIN,
  CONTRASENA, auth, uuid, json, crearCuenta, publicar, pedir, cambiarEstado, entregar, eventoWompi, conectarWs, percentil, foto,
};
