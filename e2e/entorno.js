/**
 * Entorno de las pruebas de sistema.
 * - Local (por defecto): Playwright levanta la API en el puerto 3999 sobre la base E2E y sirve la app web en 8090.
 * - Contra un servidor desplegado: E2E_API_URL=https://api.agrotech.co (y E2E_WEB_URL para la vista web).
 *   Cada prueba crea sus propios usuarios y productos, así que se puede ejecutar sobre un entorno con datos.
 */
const path = require('node:path');

const local = !process.env.E2E_API_URL;

module.exports = {
  local,
  API: (process.env.E2E_API_URL || 'http://localhost:3999').replace(/\/$/, ''),
  WEB: (process.env.E2E_WEB_URL || 'http://localhost:8090').replace(/\/$/, ''),
  BASE_DATOS: process.env.E2E_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/agrotech_e2e',
  // Secreto de eventos de Wompi del entorno probado (en local, el de abajo). Sin él, CP-18 y CP-19 se omiten.
  WOMPI_SECRETO_EVENTOS: process.env.E2E_WOMPI_SECRETO_EVENTOS || (local ? 'e2e_eventos_agrotech' : ''),
  WOMPI_ENTORNO_LOCAL: {
    WOMPI_LLAVE_PUBLICA: 'pub_test_e2e_agrotech',
    WOMPI_SECRETO_INTEGRIDAD: 'e2e_integridad_agrotech',
    WOMPI_SECRETO_EVENTOS: 'e2e_eventos_agrotech',
    WOMPI_AMBIENTE: 'test',
  },
  // Umbral de CP-05 (RNF-01): catálogo en máximo 3 s con 3G.
  UMBRAL_CATALOGO_MS: 3000,
  // Fase 2 · CP-20: buzón de correo de la API local (driver "archivo"). Contra un servidor desplegado se omite.
  BUZON: process.env.E2E_BUZON || (local ? path.resolve(__dirname, 'resultados/buzon') : ''),
  // Fase 2 · CP-30: administrador del panel. En local lo crea `npm run preparar` (scripts/crear-admin.js).
  ADMIN: {
    correo: process.env.E2E_ADMIN_CORREO || 'admin.e2e@agrotech.test',
    telefono: '3000000001',
    contrasena: process.env.E2E_ADMIN_CONTRASENA || (local ? 'panelE2E2026' : ''),
  },
  // Evidencias (capturas de pantalla) de las pruebas de interfaz, por caso de prueba.
  CAPTURAS: path.resolve(__dirname, 'resultados/capturas'),
};
