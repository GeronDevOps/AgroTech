'use strict';

const { errores } = require('../../utils/http-error');

/** Capa de controlador de productos: traduce HTTP (JSON y multipart) ↔ servicio. */
function createProductosController({ productosService, urlBaseFotos }) {
  // Sin URL configurada se usa el host de la petición (sirve con la IP de la LAN en desarrollo).
  const base = (req) => urlBaseFotos || `${req.protocol}://${req.get('host')}/fotos`;

  return {
    async publicar(req, res) {
      let datos;
      try {
        datos = JSON.parse(req.body && req.body.datos ? req.body.datos : 'null');
      } catch {
        throw errores.datosInvalidos('El campo "datos" debe ser JSON.');
      }
      if (!datos || typeof datos !== 'object') throw errores.datosInvalidos('Falta el campo "datos" con la publicación.');
      const archivos = {
        foto: req.files && req.files.foto ? req.files.foto[0] : null,
        miniatura: req.files && req.files.miniatura ? req.files.miniatura[0] : null,
      };
      const r = await productosService.publicar({ usuario: req.usuario, datos, archivos, baseFotos: base(req) });
      res.status(r.creado ? 201 : 200).json({ producto: r.producto });
    },

    async editar(req, res) {
      res.json(await productosService.editar({ usuario: req.usuario, id: req.params.id, cambios: req.body, baseFotos: base(req) }));
    },

    async catalogo(req, res) {
      res.json(await productosService.catalogo({ query: req.query, baseFotos: base(req), usuario: req.usuario }));
    },

    async detalle(req, res) {
      res.json(await productosService.detalle({ usuario: req.usuario, id: req.params.id, baseFotos: base(req) }));
    },

    async cambiarEstado(req, res) {
      res.json(await productosService.cambiarEstado({ usuario: req.usuario, id: req.params.id, body: req.body, baseFotos: base(req) }));
    },

    async mios(req, res) {
      res.json(await productosService.mios({ usuario: req.usuario, baseFotos: base(req) }));
    },
  };
}

module.exports = { createProductosController };
