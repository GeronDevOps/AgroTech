'use strict';

/**
 * Capa de datos de cuentas: solo SQL parametrizado, sin reglas de negocio.
 * Tablas: usuario, autorizacion_datos, bitacora (migración 001).
 */

const COLUMNAS = `
  id_usuario, nombres, apellidos, correo, telefono, contrasena_hash, rol, municipio,
  vereda_direccion, estado, verificado, intentos_fallidos, bloqueado_hasta, version_sesion, foto_url,
  (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueado,
  (SELECT a.version_aviso FROM autorizacion_datos a WHERE a.id_usuario = usuario.id_usuario
    ORDER BY a.fecha_aceptacion DESC LIMIT 1) AS version_aviso_aceptada`;

const { registrarBitacora: bitacora } = require('../../utils/bitacora');

function createAuthRepository({ pool }) {
  const registrarBitacora = (db, { idUsuario = null, accion, idEntidad = null, resultado }) =>
    bitacora(db, { idUsuario, accion, entidad: 'USUARIO', idEntidad: idEntidad ?? idUsuario, resultado });

  return {
    /** CU-01 pasos 3-4: usuario + autorización + bitácora en una sola transacción. */
    async crearCuenta(datos, { versionAviso, canal = 'APP' }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO usuario (nombres, apellidos, correo, telefono, contrasena_hash, rol, municipio, vereda_direccion, coordenadas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT ubicacion FROM municipio WHERE nombre = $7::varchar))
           RETURNING id_usuario`,
          [datos.nombres, datos.apellidos, datos.correo, datos.telefono, datos.contrasenaHash,
            datos.rol, datos.municipio, datos.veredaDireccion],
        );
        const { id_usuario: id } = rows[0];
        await client.query(
          'INSERT INTO autorizacion_datos (id_usuario, version_aviso, canal) VALUES ($1, $2, $3)',
          [id, versionAviso, canal],
        );
        await registrarBitacora(client, { idUsuario: id, accion: 'REGISTRO', resultado: 'EXITOSO' });
        const { rows: [usuario] } = await client.query(`SELECT ${COLUMNAS} FROM usuario WHERE id_usuario = $1`, [id]);
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

    // ---------------------------------------------------------------
    // CU-08 · Recuperar la contraseña (tabla recuperacion_contrasena, migración 006)
    // ---------------------------------------------------------------

    /** Último código creado para el usuario (para no reenviar correos en ráfaga). */
    async segundosDesdeUltimoCodigo(idUsuario) {
      const { rows } = await pool.query(
        'SELECT EXTRACT(EPOCH FROM now() - max(creado_en))::int AS s FROM recuperacion_contrasena WHERE id_usuario = $1',
        [idUsuario],
      );
      return rows[0].s;
    },

    /** Invalida el código vigente (si hay) y crea uno nuevo, en una transacción. */
    async crearCodigo(idUsuario, codigoHash, minutos) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE recuperacion_contrasena SET invalidado_en = now()
           WHERE id_usuario = $1 AND usado_en IS NULL AND invalidado_en IS NULL`,
          [idUsuario],
        );
        await client.query(
          `INSERT INTO recuperacion_contrasena (id_usuario, codigo_hash, expira_en)
           VALUES ($1, $2, now() + make_interval(mins => $3))`,
          [idUsuario, codigoHash, minutos],
        );
        await registrarBitacora(client, { idUsuario, accion: 'RECUPERAR_CONTRASENA', resultado: 'CODIGO_ENVIADO' });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    /**
     * Ejecuta fn(db, codigoVigente) dentro de una transacción con el código bloqueado (FOR UPDATE):
     * dos intentos simultáneos no pueden usar el mismo código ni saltarse el límite de 3 intentos.
     * fn devuelve { confirmar: true|false, resultado }: los intentos fallidos se confirman igual.
     */
    async conCodigoVigente(idUsuario, fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT id_recuperacion, codigo_hash, intentos, (expira_en <= now()) AS vencido
           FROM recuperacion_contrasena
           WHERE id_usuario = $1 AND usado_en IS NULL AND invalidado_en IS NULL
           FOR UPDATE`,
          [idUsuario],
        );
        const r = await fn(client, rows[0] || null);
        await client.query('COMMIT');
        return r;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    sumarIntentoCodigo: (db, id, invalidar) => db.query(
      `UPDATE recuperacion_contrasena SET intentos = intentos + 1, invalidado_en = CASE WHEN $2 THEN now() ELSE invalidado_en END
       WHERE id_recuperacion = $1 RETURNING intentos`,
      [id, invalidar],
    ),

    invalidarCodigo: (db, id) => db.query('UPDATE recuperacion_contrasena SET invalidado_en = now() WHERE id_recuperacion = $1', [id]),

    /** CU-08 paso 4: nueva contraseña, código usado y todas las sesiones anteriores cerradas (version_sesion + 1). */
    async cambiarContrasena(db, { idUsuario, idRecuperacion, contrasenaHash }) {
      await db.query('UPDATE recuperacion_contrasena SET usado_en = now() WHERE id_recuperacion = $1', [idRecuperacion]);
      await db.query(
        `UPDATE usuario SET contrasena_hash = $2, version_sesion = version_sesion + 1, intentos_fallidos = 0, bloqueado_hasta = NULL
         WHERE id_usuario = $1`,
        [idUsuario, contrasenaHash],
      );
      await registrarBitacora(db, { idUsuario, accion: 'CONTRASENA_RESTABLECIDA', resultado: 'EXITOSO' });
      const { rows } = await db.query(`SELECT ${COLUMNAS} FROM usuario WHERE id_usuario = $1`, [idUsuario]);
      return rows[0];
    },

    // CU-20 A3: aceptación de un aviso de privacidad nuevo.
    async aceptarAviso(idUsuario, versionAviso) {
      await pool.query('INSERT INTO autorizacion_datos (id_usuario, version_aviso, canal) VALUES ($1, $2, $3)', [idUsuario, versionAviso, 'APP']);
      await registrarBitacora(pool, { idUsuario, accion: 'AUTORIZACION_DATOS', resultado: 'ACEPTADA' });
    },
  };
}

module.exports = { createAuthRepository };
