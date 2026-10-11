'use strict';

/**
 * Capa de datos de cuentas: solo SQL parametrizado, sin reglas de negocio.
 * Tablas: usuario, autorizacion_datos, bitacora (migración 001).
 */

const COLUMNAS = `
  id_usuario, nombres, apellidos, correo, telefono, contrasena_hash, rol, municipio,
  vereda_direccion, estado, verificado, intentos_fallidos, bloqueado_hasta,
  (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueado`;

function createAuthRepository({ pool }) {
  async function registrarBitacora(db, { idUsuario = null, accion, idEntidad = null, resultado }) {
    await db.query(
      `INSERT INTO bitacora (id_usuario, accion, entidad, id_entidad, resultado)
       VALUES ($1, $2, 'USUARIO', $3, $4)`,
      [idUsuario, accion, idEntidad ?? idUsuario, resultado],
    );
  }

  return {
    /** CU-01 pasos 3-4: usuario + autorización + bitácora en una sola transacción. */
    async crearCuenta(datos, { versionAviso, canal = 'APP' }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO usuario (nombres, apellidos, correo, telefono, contrasena_hash, rol, municipio, vereda_direccion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING ${COLUMNAS}`,
          [datos.nombres, datos.apellidos, datos.correo, datos.telefono, datos.contrasenaHash,
            datos.rol, datos.municipio, datos.veredaDireccion],
        );
        const usuario = rows[0];
        await client.query(
          'INSERT INTO autorizacion_datos (id_usuario, version_aviso, canal) VALUES ($1, $2, $3)',
          [usuario.id_usuario, versionAviso, canal],
        );
        await registrarBitacora(client, { idUsuario: usuario.id_usuario, accion: 'REGISTRO', resultado: 'EXITOSO' });
        await client.query('COMMIT');
        return usuario;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async buscarPorCorreo(correo) {
      const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM usuario WHERE correo = $1`, [correo]);
      return rows[0] || null;
    },

    async buscarPorTelefono(telefono) {
      const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM usuario WHERE telefono = $1`, [telefono]);
      return rows[0] || null;
    },

    async buscarPorId(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM usuario WHERE id_usuario = $1`, [id]);
      return rows[0] || null;
    },

    /**
     * Suma un intento fallido de forma atómica (sin condiciones de carrera entre peticiones).
     * Al llegar al máximo fija bloqueado_hasta = now() + minutos y reinicia el contador.
     */
    async registrarIntentoFallido(id, { intentosMaximos, minutosBloqueo }) {
      const { rows } = await pool.query(
        `UPDATE usuario SET
           intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
           bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2
                                    THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
         WHERE id_usuario = $1
         RETURNING intentos_fallidos, bloqueado_hasta,
                   (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueado`,
        [id, intentosMaximos, minutosBloqueo],
      );
      return rows[0];
    },

    async reiniciarIntentos(id) {
      await pool.query(
        'UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = $1',
        [id],
      );
    },

    registrarBitacora: (evento) => registrarBitacora(pool, evento),
  };
}

module.exports = { createAuthRepository };
