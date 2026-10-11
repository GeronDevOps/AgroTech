'use strict';

const { Router } = require('express');
const { errores } = require('../../utils/http-error');
const { autenticar } = require('../../middleware/autenticacion');

/**
 * Dispositivos para notificaciones push (CU-16 paso 1 · RF-16a):
 *   POST   /dispositivos           JWT   { token, plataforma: 'ANDROID' } registra o reasigna el token FCM
 *   DELETE /dispositivos/{token}   JWT   al cerrar sesión: el teléfono deja de recibir avisos de esa cuenta
 * Un token pertenece a un solo usuario: si otra cuenta inicia sesión en el mismo teléfono, se reasigna.
 */
function dispositivosRoutes({ pool, tokens }) {
  const router = Router();
  const auth = autenticar(tokens);
  const tokenValido = (t) => typeof t === 'string' && t.length >= 20 && t.length <= 255 && /^[\w:.\-[\]]+$/.test(t);

  router.post('/', auth, async (req, res) => {
    const { token, plataforma = 'ANDROID' } = req.body || {};
    if (!tokenValido(token)) throw errores.datosInvalidos('Token de notificaciones inválido.', { campos: { token: 'Token FCM' } });
    if (plataforma !== 'ANDROID') throw errores.datosInvalidos('Solo se admite Android.', { campos: { plataforma: 'ANDROID' } });
    const { rows } = await pool.query(
      `INSERT INTO dispositivo (id_usuario, token, plataforma) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET id_usuario = EXCLUDED.id_usuario, estado = 'VIGENTE'
       RETURNING id_dispositivo, estado, (xmax = 0) AS nuevo`,
      [req.usuario.id, token, plataforma],
    );
    res.status(rows[0].nuevo ? 201 : 200).json({ dispositivo: { id: rows[0].id_dispositivo, estado: rows[0].estado } });
  });

  router.delete('/:token', auth, async (req, res) => {
    await pool.query("UPDATE dispositivo SET estado = 'INVALIDO' WHERE token = $1 AND id_usuario = $2", [req.params.token, req.usuario.id]);
    res.status(204).end();
  });

  return router;
}

module.exports = { dispositivosRoutes };
