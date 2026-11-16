'use strict';

/** Capa de controlador de cuentas: traduce HTTP ↔ servicio. */
function createAuthController({ authService }) {
  return {
    async registrar(req, res) {
      res.status(201).json(await authService.registrar(req.body));
    },
    async iniciarSesion(req, res) {
      res.status(200).json(await authService.iniciarSesion(req.body));
    },
    async yo(req, res) {
      res.status(200).json(await authService.perfil(req.usuario.id));
    },
  };
}

module.exports = { createAuthController };
