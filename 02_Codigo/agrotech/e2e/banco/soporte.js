/**
 * Soporte del banco de pruebas: cada caso BP-xxx se declara con bp('BP-xxx', fn) y toma su título del catálogo.
 * La fixture `request` (y `api` en interfaz) registra la traza HTTP del caso —método, ruta, estado, tiempo y un
 * extracto de la respuesta— y la adjunta como evidencia «traza» que el reportero lleva al documento.
 */
const fs = require('node:fs');
const path = require('node:path');
const base = require('@playwright/test');
const { banco } = require('./banco');
const { API, CAPTURAS } = require('../entorno');
const { CONTRASENA } = require('../soporte/api');

const CAPTURAS_BANCO = path.join(path.dirname(CAPTURAS), 'banco', 'capturas');
const RECORTE = 220;
const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'fetch'];

function extracto(texto) {
  if (!texto) return '';
  const limpio = texto.replace(/"token":"[^"]+"/g, '"token":"…"').replace(/\s+/g, ' ');
  return limpio.length > RECORTE ? `${limpio.slice(0, RECORTE)}…` : limpio;
}

/** Envuelve un APIRequestContext para registrar cada llamada en `traza`. */
function conTraza(ctx, traza) {
  const envuelto = Object.create(ctx);
  for (const m of METODOS) {
    envuelto[m] = async (url, opciones = {}) => {
      const t0 = Date.now();
      const r = await ctx[m](url, opciones);
      let cuerpo = '';
      try { cuerpo = await r.text(); } catch { /* respuesta sin cuerpo */ }
      const enviado = opciones.data !== undefined ? extracto(typeof opciones.data === 'string' ? opciones.data : JSON.stringify(opciones.data))
        : opciones.multipart ? '(multipart: datos + foto + miniatura)' : '';
      traza.push({
        metodo: (opciones.method || (m === 'fetch' ? 'GET' : m)).toUpperCase(),
        ruta: `/${String(url).replace(/^\//, '')}`.replace(/\/api\/v1/, ''),
        estado: r.status(),
        ms: Date.now() - t0,
        enviado,
        respuesta: extracto(cuerpo),
      });
      return r;
    };
  }
  return envuelto;
}

const test = base.test.extend({
  traza: async ({}, use) => { await use([]); },
  request: async ({ request, traza }, use, info) => {
    await use(conTraza(request, traza));
    if (traza.length) await info.attach('traza', { body: JSON.stringify(traza), contentType: 'application/json' });
  },
  api: async ({ playwright, traza }, use, info) => {
    const ctx = await playwright.request.newContext({ baseURL: `${API}/api/v1/` });
    await use(conTraza(ctx, traza));
    if (traza.length) await info.attach('traza', { body: JSON.stringify(traza), contentType: 'application/json' });
    await ctx.dispose();
  },
});

/** Declara el caso del banco: título y etiqueta salen del catálogo. */
function bp(id, cuerpo, opciones = {}) {
  const caso = banco.find((x) => x.id === id);
  if (!caso) throw new Error(`${id} no está en banco.js`);
  test(`${id} · ${caso.titulo}`, { tag: [`@${id}`, `@${caso.req.split(',')[0].trim()}`], ...opciones }, cuerpo);
}

/** Medición que el reportero muestra junto al resultado del caso. */
const medir = (texto) => base.test.info().annotations.push({ type: 'medición', description: texto });

/** Captura de un paso de un caso de interfaz: resultados/banco/capturas/BP-xxx_nn_paso.png */
async function captura(page, paso) {
  const info = base.test.info();
  const id = (info.tags.find((t) => /^@BP-\d{3}$/.test(t)) || '@BP-000').slice(1);
  info.__n = (info.__n || 0) + 1;
  const nombre = `${id}_${String(info.__n).padStart(2, '0')}_${paso.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').toLowerCase()}.png`;
  fs.mkdirSync(CAPTURAS_BANCO, { recursive: true });
  const ruta = path.join(CAPTURAS_BANCO, nombre);
  await page.waitForTimeout(600);
  await page.screenshot({ path: ruta });
  await info.attach(`captura: ${paso}`, { path: ruta, contentType: 'image/png' });
}

async function entrar(page, identificador, contrasena = CONTRASENA) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo o celular').fill(identificador);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(contrasena);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

module.exports = { test, expect: base.expect, bp, medir, captura, entrar, CAPTURAS_BANCO };
