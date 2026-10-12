'use strict';

const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isTest = NODE_ENV === 'test';

function required(name, value) {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revise api/.env (ver .env.example).`);
  }
  return value;
}

function secreto(name, value) {
  required(name, value);
  if (value.length < 32) throw new Error(`La variable ${name} debe tener al menos 32 caracteres.`);
  return value;
}

function toInt(name, value, fallback) {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) throw new Error(`La variable ${name} debe ser un entero positivo.`);
  return n;
}

function unoDe(name, value, permitidos) {
  if (!permitidos.includes(value)) throw new Error(`La variable ${name} debe ser una de: ${permitidos.join(', ')}.`);
  return value;
}

const config = Object.freeze({
  env: NODE_ENV,
  isTest,
  port: toInt('PORT', process.env.PORT, 3000),
  databaseUrl: isTest
    ? required('DATABASE_URL_TEST', process.env.DATABASE_URL_TEST)
    : required('DATABASE_URL', process.env.DATABASE_URL),
  dbPoolMax: toInt('DB_POOL_MAX', process.env.DB_POOL_MAX, 10),
  // Orígenes permitidos para la vista web de desarrollo (la app Android no usa CORS).
  corsOrigins: (process.env.CORS_ORIGINS || (NODE_ENV === 'development' ? 'http://localhost:8081' : ''))
    .split(',').map((o) => o.trim()).filter(Boolean),
  auth: Object.freeze({
    // En pruebas se usa un secreto fijo; en desarrollo y producción es obligatorio (≥ 32 caracteres).
    jwtSecreto: isTest
      ? (process.env.JWT_SECRETO || 'secreto-exclusivo-de-pruebas-automaticas-agrotech')
      : secreto('JWT_SECRETO', process.env.JWT_SECRETO),
    jwtExpiraEn: process.env.JWT_EXPIRA_EN || '7d',
    bcryptCosto: toInt('BCRYPT_COSTO', process.env.BCRYPT_COSTO, isTest ? 4 : 12),
    intentosMaximos: 5, // CU-21 A1
    minutosBloqueo: 15, // CU-21 A1
    versionAvisoPrivacidad: process.env.AVISO_PRIVACIDAD_VERSION || '1.0',
  }),
  fotos: Object.freeze({
    // "local" (desarrollo y pruebas) o "s3" (AWS, AGRO-16). Misma interfaz en ambos drivers.
    driver: unoDe('FOTOS_DRIVER', process.env.FOTOS_DRIVER || 'local', ['local', 's3']),
    s3Bucket: process.env.FOTOS_S3_BUCKET || '',
    s3Region: process.env.AWS_REGION || 'us-east-1',
    dir: process.env.FOTOS_DIR
      ? path.resolve(process.env.FOTOS_DIR)
      : path.resolve(__dirname, isTest ? '../../tmp/fotos-pruebas' : '../../uploads'),
    // URL pública base; si está vacía se arma con el host de la petición (útil con la IP de la LAN).
    urlBase: (process.env.FOTOS_URL_BASE || '').replace(/\/$/, ''),
    maxBytes: 300 * 1024, // RNF-09: foto comprimida ≤ 300 KB
    maxBytesMiniatura: 40 * 1024, // 20 miniaturas ≈ 400 KB → primera página ≤ 500 KB (RNF-09)
  }),
  wompi: Object.freeze({
    // ADR-001. En pruebas automáticas se usan valores ficticios; en desarrollo y AWS van en api/.env.
    llavePublica: process.env.WOMPI_LLAVE_PUBLICA || (isTest ? 'pub_test_agrotech_pruebas' : ''),
    secretoIntegridad: process.env.WOMPI_SECRETO_INTEGRIDAD || (isTest ? 'test_integrity_agrotech_pruebas' : ''),
    secretoEventos: process.env.WOMPI_SECRETO_EVENTOS || (isTest ? 'test_events_agrotech_pruebas' : ''),
    ambiente: process.env.WOMPI_AMBIENTE || 'test',                 // "test" = sandbox, "prod" = producción
    urlCheckout: process.env.WOMPI_URL_CHECKOUT || 'https://checkout.wompi.co/p/',
    urlRetorno: process.env.WOMPI_URL_RETORNO || '',                 // p. ej. https://api.agrotech.co/api/v1/pagos/retorno
    retornoApp: process.env.WOMPI_RETORNO_APP || 'agrotech://pago',  // a dónde redirige /pagos/retorno
  }),
  // RF-16a: ruta al JSON de la cuenta de servicio de Firebase (FCM HTTP v1). Vacía = avisos push desactivados.
  fcmCredenciales: process.env.FCM_CREDENCIALES || '',
  horasCancelacionAutomatica: toInt('HORAS_CANCELACION', process.env.HORAS_CANCELACION, 48),
  migrationsDir: process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(__dirname, '../../../db/migrations'),
});

module.exports = config;
