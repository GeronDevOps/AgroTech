#!/usr/bin/env node
'use strict';

/**
 * npm run crear-admin -- --correo admin@asociacion.co --telefono 3001234567 --nombres "Ana" --apellidos "Vera" --municipio Pamplona
 *
 * Crea la cuenta de ADMINISTRADOR del panel web (CU-18). El rol no se puede elegir al registrarse en la app
 * (solo PRODUCTOR o CONSUMIDOR): lo asigna el equipo con este script, directamente en la base de datos.
 * La contraseña se pide por la variable ADMIN_CONTRASENA (no queda en el historial de la terminal) y se guarda con Bcrypt.
 */
const config = require('../src/config/env');
const { pool } = require('../src/db/pool');
const { createHasher } = require('../src/modules/auth/seguridad');
const { errorContrasena, normalizarTelefono } = require('../src/modules/auth/auth.validacion');
const { municipioOficial } = require('../src/datos/municipios');
const { registrarBitacora } = require('../src/utils/bitacora');

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : porDefecto;
}

async function principal() {
  const correo = (argumento('correo') || '').trim().toLowerCase();
  const telefono = normalizarTelefono(argumento('telefono') || '');
  const nombres = argumento('nombres', 'Administrador');
  const apellidos = argumento('apellidos', 'AgroTech');
  const municipio = municipioOficial(argumento('municipio', 'Pamplona'));
  const contrasena = process.env.ADMIN_CONTRASENA || '';
  if (!correo || !/^3\d{9}$/.test(telefono) || !municipio) throw new Error('Indique --correo, --telefono (celular de 10 dígitos) y --municipio de Norte de Santander.');
  const errClave = errorContrasena(contrasena);
  if (errClave) throw new Error(`ADMIN_CONTRASENA: ${errClave}`);

  const hash = await createHasher({ costo: config.auth.bcryptCosto }).hash(contrasena);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [u] } = await client.query(
      `INSERT INTO usuario (nombres, apellidos, correo, telefono, contrasena_hash, rol, municipio, coordenadas)
       VALUES ($1, $2, $3, $4, $5, 'ADMINISTRADOR', $6::varchar, (SELECT ubicacion FROM municipio WHERE nombre = $6::varchar))
       RETURNING id_usuario`,
      [nombres, apellidos, correo, telefono, hash, municipio],
    );
    await client.query('INSERT INTO autorizacion_datos (id_usuario, version_aviso, canal) VALUES ($1, $2, $3)', [u.id_usuario, config.auth.versionAvisoPrivacidad, 'PANEL']);
    await registrarBitacora(client, { idUsuario: u.id_usuario, accion: 'ADMIN_CREADO', idEntidad: u.id_usuario });
    await client.query('COMMIT');
    console.log(`[crear-admin] Administrador creado: ${correo} (${u.id_usuario}). Ingresa al panel en la app web con ese correo.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.code === '23505' ? new Error('Ya existe una cuenta con ese correo o celular.') : err;
  } finally {
    client.release();
  }
}

principal()
  .catch((err) => { console.error(`[crear-admin] ${err.message}`); process.exitCode = 1; })
  .finally(() => pool.end());
