/**
 * Ayudas de las pruebas de interfaz (proyecto "ui"): la app web de Expo en un navegador con tamaño de teléfono.
 * Los datos de partida (cuentas, productos, pedidos) se crean por la API; lo que se evalúa se hace en la pantalla.
 */
const base = require('@playwright/test');
const { API } = require('../entorno');
const { CONTRASENA } = require('../soporte/api');

const test = base.test.extend({
  /** Cliente HTTP de la API (la baseURL del proyecto "ui" es la app web). */
  api: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: `${API}/api/v1/` });
    await use(ctx);
    await ctx.dispose();
  },
  /** Segundo teléfono (otro usuario) con el mismo tamaño de pantalla, idioma y zona horaria. */
  otraPagina: async ({
    browser, baseURL, viewport, locale, timezoneId, deviceScaleFactor, userAgent,
  }, use) => {
    const ctx = await browser.newContext({ baseURL, viewport, locale, timezoneId, deviceScaleFactor, userAgent });
    const pagina = await ctx.newPage();
    await use(pagina);
    await ctx.close();
  },
});

/** CU-01 · Iniciar sesión desde la bienvenida. */
async function entrar(page, identificador) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo o celular').fill(identificador);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/**
 * Modo avión / vuelve la señal. Chromium emulado no siempre emite el evento "change" de navigator.connection
 * (del que depende NetInfo en la web), así que se emite a mano en ambos sentidos.
 */
async function red(page, enLinea) {
  await page.context().setOffline(!enLinea);
  await page.evaluate(() => navigator.connection && navigator.connection.dispatchEvent(new Event('change')));
}

/** Perfil "3G" de Chrome DevTools (antes "Fast 3G"): 562,5 ms de latencia, 1,44 Mbps de bajada, 675 kbps de subida. */
const RED_3G = { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1000 * 1000 / 8) * 0.9, uploadThroughput: (750 * 1000 / 8) * 0.9 };
async function emular3G(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RED_3G);
  return cdp;
}

/** Tarjetas de producto visibles: [{ nombre, municipio }] leídas de su etiqueta accesible. */
async function tarjetasVisibles(page) {
  return page.$$eval('[role="button"][aria-label*=" disponibles, "]', (els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => {
      const l = e.getAttribute('aria-label');
      return { nombre: l.split(',')[0], municipio: l.split(' disponibles, ')[1].split(',')[0] };
    }));
}

module.exports = { test, expect: base.expect, entrar, red, emular3G, RED_3G, tarjetasVisibles };
