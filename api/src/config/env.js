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
  migrationsDir: process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(__dirname, '../../../db/migrations'),
});

module.exports = config;
