'use strict';

const { errores } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { registrarBitacora } = require('../../utils/bitacora');
const { validarPerfil } = require('./perfil.validacion');
const { esJpeg } = require('../productos/productos.validacion');

const RESTRICCION_A_CAMPO = { uq_usuario_correo: 'correo', uq_usuario_telefono: 'telefono' };

/** Perfil completo: solo lo ve su titular (RNF-05). */
function perfilPublico(f, almacen, baseFotos) {
  return {
    id: f.id_usuario,
    nombres: f.nombres,
    apellidos: f.apellidos,
    correo: f.correo,
    telefono: f.telefono,
    rol: f.rol,
    municipio: f.municipio,
    veredaDireccion: f.vereda_direccion,
    verificado: f.verificado,
    fotoUrl: f.foto_url && almacen ? almacen.urlPublica(f.foto_url, baseFotos) : null,
    ubicacion: f.lat === null || f.lat === undefined ? null : {
      lat: Number(f.lat), lon: Number(f.lon), origen: f.en_cabecera ? 'MUNICIPIO' : 'TELEFONO',
    },
    fechaRegistro: f.fecha_registro,
    actualizadoEn: f.actualizado_en,
  };
}

/**
 * CU-09 · Gestionar el perfil (RF-09).
 * A1 el rol no se edita · A2 correo o celular de otra cuenta → 409 DATO_EN_USO · A3 sin señal: la app lo encola (PERFIL.EDITAR).
 */
function createPerfilService({ pool, perfilRepository: repo, almacenFotos, limitesFotos }) {
  const publico = (f, base) => perfilPublico(f, almacenFotos, base);

  async function actualizarEn(db, usuario, c) {
    try {
      await db.query('SAVEPOINT perfil');
      await repo.actualizar(db, usuario.id, c);
      await db.query('RELEASE SAVEPOINT perfil');
    } catch (err) {
      await db.query('ROLLBACK TO SAVEPOINT perfil').catch(() => {});
      if (err.code === '23505' && RESTRICCION_A_CAMPO[err.constraint]) {
        const campo = RESTRICCION_A_CAMPO[err.constraint];
        throw errores.conflicto('DATO_EN_USO', campo === 'correo' ? 'Ese correo ya pertenece a otra cuenta.' : 'Ese celular ya pertenece a otra cuenta.', { campo });
      }
      throw err;
    }
    await registrarBitacora(db, { idUsuario: usuario.id, accion: 'PERFIL_ACTUALIZADO', idEntidad: usuario.id, resultado: Object.keys(c).join(',').slice(0, 20) });
  }

  return {
    async obtener({ usuario, baseFotos }) {
      const f = await repo.buscar(usuario.id);
      if (!f) throw errores.noEncontrado('La cuenta no existe.');
      return { perfil: publico(f, baseFotos) };
    },

    /** `db`: desde /sync/push (cambio hecho sin señal, CU-09 A3). */
    async actualizar({ usuario, body, baseFotos, db }) {
      const c = validarPerfil(body);
      if (db) await actualizarEn(db, usuario, c);
      else await transaccion(pool, (tx) => actualizarEn(tx, usuario, c));
      return { perfil: publico(await repo.buscar(usuario.id, db), baseFotos) };
    },

    /** CU-09 paso 2: foto de perfil (JPEG ≤ 300 KB). Clave nueva en cada cambio para no servir la foto vieja de la caché. */
    async cambiarFoto({ usuario, archivo, baseFotos }) {
      if (!archivo || !esJpeg(archivo.buffer)) throw errores.datosInvalidos('Elija una foto JPEG.', { campos: { foto: 'Foto JPEG' } });
      if (archivo.buffer.length > limitesFotos.maxBytes) throw errores.datosInvalidos('La foto supera 300 KB.', { campos: { foto: 'Máximo 300 KB' } });
      const clave = `perfiles/${usuario.id}/${Date.now()}.jpg`;
      try {
        await almacenFotos.guardar(clave, archivo.buffer, 'image/jpeg');
      } catch {
        throw errores.noDisponible('No se pudo guardar la foto. Intente de nuevo en unos minutos.');
      }
      const anterior = await repo.cambiarFoto(usuario.id, clave);
      if (anterior) almacenFotos.eliminar(anterior).catch(() => {});
      await registrarBitacora(pool, { idUsuario: usuario.id, accion: 'PERFIL_FOTO', idEntidad: usuario.id });
      return { perfil: publico(await repo.buscar(usuario.id), baseFotos) };
    },
  };
}

module.exports = { createPerfilService, perfilPublico };
