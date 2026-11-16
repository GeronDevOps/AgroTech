'use strict';

/**
 * Bitácora de auditoría (tabla bitacora, migración 001): quién hizo qué, sobre qué entidad y con qué resultado.
 * `db` puede ser el pool o el cliente de una transacción (la entrada se confirma o revierte con ella).
 */
async function registrarBitacora(db, { idUsuario = null, accion, entidad = 'USUARIO', idEntidad = null, resultado = 'EXITOSO' }) {
  await db.query(
    'INSERT INTO bitacora (id_usuario, accion, entidad, id_entidad, resultado) VALUES ($1, $2, $3, $4, $5)',
    [idUsuario, accion.slice(0, 40), entidad.slice(0, 40), idEntidad, resultado.slice(0, 20)],
  );
}

module.exports = { registrarBitacora };
