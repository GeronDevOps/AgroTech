#!/usr/bin/env node
'use strict';

/**
 * npm run sembrar — datos de demostración para la sustentación, la capacitación y el piloto (AGRO-15).
 *
 * Usa solo la API pública (como la app): registro, publicación con foto, pedidos, chat y calificación.
 * Es idempotente: los identificadores salen de una semilla fija, así que ejecutarlo de nuevo no duplica nada
 * (POST /productos con el mismo id, Idempotency-Key fija en los pedidos, id fijo en los mensajes).
 *
 *   npm run sembrar                                  → http://localhost:3000
 *   npm run sembrar -- --api https://api-pruebas.agrotech.co --confirmar
 *
 * Contra una URL que no sea local exige --confirmar, para no mezclar datos de ejemplo con los del piloto.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const CONTRASENA = 'cosecha2026';
const FOTOS = path.join(__dirname, 'semilla');

/** UUID v4 determinista a partir de un texto (mismo texto → mismo id en cada ejecución). */
function uuidDe(semilla) {
  const h = crypto.createHash('sha256').update(`agrotech-semilla:${semilla}`).digest('hex');
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const PRODUCTORES = [
  { clave: 'rosa', nombres: 'Rosa', apellidos: 'Peñaranda', telefono: '3105551234', municipio: 'Pamplonita', veredaDireccion: 'Vereda El Diamante' },
  { clave: 'luis', nombres: 'Luis', apellidos: 'Quintero', telefono: '3115552222', municipio: 'Ocaña', veredaDireccion: 'Vereda La Ermita' },
  { clave: 'marta', nombres: 'Marta', apellidos: 'Jaimes', telefono: '3125553333', municipio: 'Chinácota', veredaDireccion: 'Vereda Lobatica' },
  { clave: 'jorge', nombres: 'Jorge', apellidos: 'Rincón', telefono: '3135554444', municipio: 'Ábrego', veredaDireccion: 'Vereda Capitán Largo' },
];
const CONSUMIDORES = [
  { clave: 'andres', nombres: 'Andrés', apellidos: 'Contreras', telefono: '3205550000', municipio: 'Cúcuta' },
  { clave: 'maria', nombres: 'María', apellidos: 'Ortega', telefono: '3215551111', municipio: 'Pamplona' },
];
const PRODUCTOS = [
  { clave: 'cafe', de: 'rosa', foto: 'cafe', nombre: 'Café pergamino seco', categoria: 'CAFE_CACAO', unidad: 'kg', precio: 21500, stock: 80, descripcion: 'Secado al sol, cosecha de octubre.' },
  { clave: 'mora', de: 'rosa', foto: 'mora', nombre: 'Mora de castilla', categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 30, descripcion: 'Recogida esta semana.' },
  { clave: 'papa', de: 'rosa', foto: 'papa', nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20, descripcion: 'Bulto de 50 kg, lavada.' },
  { clave: 'cebolla', de: 'luis', foto: 'cebolla', nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, stock: 40, descripcion: 'Recién cortada.' },
  { clave: 'platano', de: 'luis', foto: 'platano', nombre: 'Plátano hartón', categoria: 'PLATANO', unidad: 'kg', precio: 2800, stock: 150 },
  { clave: 'tomate', de: 'marta', foto: 'tomate', nombre: 'Tomate chonto', categoria: 'HORTALIZAS', unidad: 'canastilla', precio: 48000, stock: 12, descripcion: 'Maduro, para mesa.' },
  { clave: 'yuca', de: 'jorge', foto: 'yuca', nombre: 'Yuca', categoria: 'TUBERCULOS', unidad: 'arroba', precio: 28000, stock: 25 },
];
/** Pedidos de ejemplo: uno en cada estado, con chat y una calificación. */
const PEDIDOS = [
  { clave: 'p1', de: 'andres', items: [['papa', 2]], estado: 'ENTREGADO', chat: [['andres', '¿Puede entregar el sábado en el parque principal?'], ['rosa', 'Sí, a las 9 de la mañana.']], calificacion: { puntuacion: 5, comentario: 'Muy puntual y la papa llegó limpia.' } },
  { clave: 'p2', de: 'maria', items: [['mora', 3]], estado: 'ACEPTADO', chat: [['maria', 'Buenos días, ¿la mora viene en canastilla?']] },
  { clave: 'p3', de: 'andres', items: [['cebolla', 1], ['platano', 10]], estado: 'PENDIENTE' },
  { clave: 'p4', de: 'maria', items: [['tomate', 1]], estado: 'EN_CAMINO' },
  { clave: 'p5', de: 'andres', items: [['yuca', 2]], estado: 'CANCELADO', motivo: 'La lluvia dañó la carretera de la vereda.' },
];
const CAMINO = { PENDIENTE: [], ACEPTADO: ['ACEPTADO'], EN_CAMINO: ['ACEPTADO', 'EN_CAMINO'], ENTREGADO: ['ACEPTADO', 'EN_CAMINO', 'ENTREGADO'], CANCELADO: ['CANCELADO'] };

function opciones(argv) {
  const i = argv.indexOf('--api');
  const api = (i >= 0 ? argv[i + 1] : `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const host = new URL(api).hostname;
  const local = ['localhost', '127.0.0.1', '::1'].includes(host) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
  return { api, local, confirmar: argv.includes('--confirmar') };
}

function crearCliente(base) {
  async function llamar(metodo, ruta, { token, json, form, cabeceras = {} } = {}) {
    const r = await fetch(`${base}/api/v1${ruta}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
      body: json ? JSON.stringify(json) : form,
    });
    const texto = await r.text();
    return { status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
  }
  const exigir = (r, ...validos) => {
    if (!validos.includes(r.status)) throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.cuerpo)}`);
    return r.cuerpo;
  };
  return { llamar, exigir };
}

async function sembrar({ api, log = console.log }) {
  const { llamar, exigir } = crearCliente(api);
  const salud = exigir(await llamar('GET', '/salud'), 200);
  log(`API ${api} · migración ${salud.baseDeDatos.migracion}`);

  // 1) Cuentas (CU-01): si ya existe, se inicia sesión.
  const cuentas = {};
  for (const [rol, lista] of [['PRODUCTOR', PRODUCTORES], ['CONSUMIDOR', CONSUMIDORES]]) {
    for (const c of lista) {
      const correo = `${c.clave}@demo.agrotech.co`;
      const { clave, ...datos } = c;
      let r = await llamar('POST', '/auth/registro', { json: { ...datos, correo, contrasena: CONTRASENA, rol, aceptaTratamientoDatos: true } });
      if (r.status === 409) r = await llamar('POST', '/auth/sesion', { json: { identificador: correo, contrasena: CONTRASENA } });
      const b = exigir(r, 200, 201);
      cuentas[clave] = { token: b.token, id: b.usuario.id, nombre: `${c.nombres} ${c.apellidos}`, correo, telefono: c.telefono, rol, municipio: c.municipio };
    }
  }

  // 2) Publicaciones con foto y miniatura (CU-02). Mismo id → la API devuelve la existente.
  const productos = {};
  for (const p of PRODUCTOS) {
    const productor = cuentas[p.de];
    const form = new FormData();
    const datos = {
      id: uuidDe(`producto:${p.clave}`), nombre: p.nombre, categoria: p.categoria, unidad: p.unidad,
      precio: p.precio, stock: p.stock, descripcion: p.descripcion, municipio: productor.municipio,
    };
    form.append('datos', JSON.stringify(datos));
    form.append('foto', new Blob([await fs.readFile(path.join(FOTOS, `${p.foto}.jpg`))], { type: 'image/jpeg' }), `${p.foto}.jpg`);
    form.append('miniatura', new Blob([await fs.readFile(path.join(FOTOS, `${p.foto}_min.jpg`))], { type: 'image/jpeg' }), `${p.foto}_min.jpg`);
    productos[p.clave] = exigir(await llamar('POST', '/productos', { token: productor.token, form }), 200, 201).producto;
  }

  // 3) Pedidos (CU-04) llevados a su estado (CU-13), con chat (CU-05) y calificación (CU-06).
  const resumen = [];
  for (const p of PEDIDOS) {
    const consumidor = cuentas[p.de];
    const items = p.items.map(([clave, cantidad]) => ({ idProducto: productos[clave].id, cantidad }));
    const r = await llamar('POST', '/pedidos', {
      token: consumidor.token,
      cabeceras: { 'Idempotency-Key': uuidDe(`pedido:${p.clave}`) },
      json: { items, puntoEntrega: 'Parque principal', franjaEntrega: 'MANANA' },
    });
    if (r.status === 409 && r.cuerpo.error.codigo === 'STOCK_INSUFICIENTE') {
      log(`  · ${p.clave}: sin stock suficiente, se omite`);
      continue;
    }
    let pedido = exigir(r, 200, 201).pedidos[0];
    const productor = Object.values(cuentas).find((c) => c.id === pedido.productor.id);

    for (const [i, [quien, contenido]] of (p.chat || []).entries()) {
      const m = await llamar('POST', `/pedidos/${pedido.id}/mensajes`, { token: cuentas[quien].token, json: { id: uuidDe(`mensaje:${p.clave}:${i}`), contenido } });
      exigir(m, 200, 201, 409); // 409: el chat ya se cerró en una ejecución anterior
    }
    const hechos = new Set(['PENDIENTE', ...(CAMINO[pedido.estado] || [])]);
    for (const estado of CAMINO[p.estado]) {
      if (hechos.has(estado) || pedido.estado === 'CANCELADO' || pedido.estado === 'ENTREGADO') continue;
      const extra = estado === 'CANCELADO' ? { motivo: p.motivo } : {};
      pedido = exigir(await llamar('PATCH', `/pedidos/${pedido.id}/estado`, { token: productor.token, json: { estado, version: pedido.version, ...extra } }), 200).pedido;
    }
    if (p.calificacion && pedido.estado === 'ENTREGADO') {
      exigir(await llamar('POST', `/pedidos/${pedido.id}/calificacion`, { token: consumidor.token, json: p.calificacion }), 201, 409);
    }
    resumen.push({ pedido: p.clave, consumidor: consumidor.nombre, productor: productor.nombre, estado: pedido.estado, total: pedido.total });
  }
  return { cuentas, productos, resumen };
}

async function principal() {
  const op = opciones(process.argv.slice(2));
  if (!op.local && !op.confirmar) {
    console.error(`La API ${op.api} no es local. Agregue --confirmar si de verdad quiere sembrar datos de ejemplo allí.`);
    process.exit(2);
  }
  const { cuentas, productos, resumen } = await sembrar(op);
  console.log(`\nCuentas (contraseña para todas: ${CONTRASENA})`);
  console.table(Object.values(cuentas).map(({ nombre, rol, correo, telefono, municipio }) => ({ nombre, rol, correo, celular: telefono, municipio })));
  console.log(`Publicaciones: ${Object.keys(productos).length}`);
  console.table(resumen);
}

if (require.main === module) {
  principal().catch((err) => { console.error('No se pudieron sembrar los datos:', err.message); process.exit(1); });
}

module.exports = { sembrar, uuidDe, PRODUCTORES, CONSUMIDORES, PRODUCTOS, PEDIDOS };
