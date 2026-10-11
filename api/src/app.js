'use strict';

const express = require('express');
const { apiRoutes } = require('./routes');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { cors } = require('./middleware/cors');
const config = require('./config/env');

/**
 * Crea la aplicación Express sin abrir el puerto, para poder probarla con supertest.
 * @param {{ pool: import('pg').Pool }} deps dependencias inyectadas
 */
function createApp(deps) {
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
  app.use(cors(config.corsOrigins));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', apiRoutes(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
