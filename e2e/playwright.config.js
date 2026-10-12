// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { local, API, WEB, BASE_DATOS, WOMPI_ENTORNO_LOCAL } = require('./entorno');

/**
 * AGRO-14 · Pruebas de sistema (caja negra) de AgroTech.
 *   npm run preparar   → migra la base E2E y compila la app web contra la API de pruebas (solo en local)
 *   npm test           → ejecuta los proyectos "api" y "ui" y genera:
 *                        informe-html/ (detalle con trazas y capturas), resultados/junit.xml (CI)
 *                        y resultados/informe-cp.md (matriz CP-01…CP-19 → resultado, para el informe de pruebas)
 */
module.exports = defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'informe-html', open: 'never' }],
    ['junit', { outputFile: 'resultados/junit.xml' }],
    ['./reportero-cp.js', { salida: 'resultados/informe-cp.md' }],
  ],
  outputDir: 'resultados/evidencias',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [
    { name: 'api', testDir: './api', use: { baseURL: `${API}/api/v1/` } },
    {
      name: 'ui',
      testDir: './ui',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        isMobile: false, // la vista web de Expo no necesita emulación táctil; se conserva el tamaño de teléfono
        hasTouch: false,
        baseURL: WEB,
        ...(process.env.CHROMIUM_EJECUTABLE ? { launchOptions: { executablePath: process.env.CHROMIUM_EJECUTABLE } } : {}),
      },
    },
  ],
  // En local, Playwright levanta la API y la app web; contra un servidor desplegado no levanta nada.
  webServer: local ? [
    {
      command: 'node src/server.js',
      cwd: '../api',
      url: `${API}/api/v1/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: new URL(API).port,
        DATABASE_URL: BASE_DATOS,
        JWT_SECRETO: 'e2e-secreto-de-pruebas-de-sistema-0123456789',
        CORS_ORIGINS: WEB,
        BCRYPT_COSTO: '10',
        ...WOMPI_ENTORNO_LOCAL,
        ...(process.env.MIGRATIONS_DIR ? { MIGRATIONS_DIR: process.env.MIGRATIONS_DIR } : {}),
      },
    },
    {
      command: 'node soporte/servidor-web.js',
      url: WEB,
      reuseExistingServer: !process.env.CI,
      env: { PUERTO_WEB: new URL(WEB).port },
    },
  ] : undefined,
});
