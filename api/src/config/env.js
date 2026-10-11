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
  migrationsDir: process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(__dirname, '../../../db/migrations'),
});

module.exports = config;
