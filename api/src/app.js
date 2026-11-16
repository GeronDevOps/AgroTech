'use strict';

const express = require('express');
const { apiRoutes } = require('./routes');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { cors } = require('./middleware/cors');
const config = require('./config/env');
const { crearAlmacenFotos } = require('./almacenamiento');

/**
 * Crea la aplicación Express sin abrir el puerto, para poder probarla con supertest.
 * @param {{ pool: import('pg').Pool, almacenFotos?: object }} deps dependencias inyectadas
 */
function createApp(deps) {
  const almacenFotos = deps.almacenFotos || crearAlmacenFotos(config.fotos);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás del Application Load Balancer de AWS

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.use(cors(config.corsOrigins, { redLocal: config.env === 'development' }));
  app.use(express.json({ limit: '1mb' }));

  // Fotos del driver local: nombres únicos por publicación, se pueden guardar en caché mucho tiempo.
  // Con S3 la app las descarga directo del bucket y la API no las sirve.
  if (almacenFotos.tipo === 'local') {
    app.use('/fotos', express.static(almacenFotos.dir, { immutable: true, maxAge: '30d', index: false }));
  }
  const api = apiRoutes({ ...deps, almacenFotos });
  app.use('/api/v1', api);
  app.locals.servicios = api.servicios;   // la tarea programada de server.js usa pedidosService

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
