'use strict';

/** Capa de controlador: traduce HTTP ↔ servicio. */
function createSaludController({ saludService }) {
  return {
    async obtener(req, res) {
      const resultado = await saludService.estado();
      res.status(resultado.estado === 'ok' ? 200 : 503).json(resultado);
    },
  };
}

module.exports = { createSaludController };
