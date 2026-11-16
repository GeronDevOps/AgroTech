// @ts-check
/**
 * Banco de pruebas del sistema (BP-001 … BP-103): `npm run banco`
 *   banco-api  casos de caja negra por HTTP y WebSocket (banco/*.api.spec.js)
 *   banco-ui   casos de interfaz con capturas por paso (banco/*.ui.spec.js)
 * Usa los mismos servidores que la suite CP (API y app web locales, o un servidor desplegado con E2E_API_URL).
 */
const { defineConfig, devices } = require('@playwright/test');
const principal = require('./playwright.config');
const { API, WEB } = require('./entorno');

module.exports = defineConfig({
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'informe-banco-html', open: 'never' }],
    ['junit', { outputFile: 'resultados/banco/junit.xml' }],
    ['./reportero-banco.js', { salida: 'resultados/banco' }],
  ],
  outputDir: 'resultados/banco/evidencias',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'es-CO', timezoneId: 'America/Bogota' },
  projects: [
    { name: 'banco-api', testDir: './banco', testMatch: /\.api\.spec\.js$/, use: { baseURL: `${API}/api/v1/` } },
    {
      name: 'banco-ui',
      testDir: './banco',
      testMatch: /\.ui\.spec\.js$/,
      use: {
        ...devices['Pixel 7'], browserName: 'chromium', isMobile: false, hasTouch: false, baseURL: WEB,
        ...(process.env.CHROMIUM_EJECUTABLE ? { launchOptions: { executablePath: process.env.CHROMIUM_EJECUTABLE } } : {}),
      },
    },
  ],
  webServer: principal.webServer,
});
