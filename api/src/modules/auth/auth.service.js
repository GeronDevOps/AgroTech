'use strict';

const { errores } = require('../../utils/http-error');
const { validarRegistro, validarSesion } = require('./auth.validacion');

/** Datos que se pueden enviar a la app (nunca el hash ni los contadores de seguridad). */
function usuarioPublico(u) {
  return {
    id: u.id_usuario,
    nombres: u.nombres,
    apellidos: u.apellidos,
    correo: u.correo,
    telefono: u.telefono,
    rol: u.rol,
    municipio: u.municipio,
    veredaDireccion: u.vereda_direccion,
    verificado: u.verificado,
  };
}

const RESTRICCION_A_CAMPO = { uq_usuario_correo: 'correo', uq_usuario_telefono: 'telefono' };

/**
 * Capa de negocio de CU-01 (registrarse) y CU-21 (iniciar sesión).
 * @param {object} deps
 * @param {ReturnType<import('./auth.repository').createAuthRepository>} deps.authRepository
 * @param {{hash: Function, comparar: Function}} deps.hasher
 * @param {{firmar: Function}} deps.tokens
 * @param {{intentosMaximos: number, minutosBloqueo: number, versionAvisoPrivacidad: string}} deps.politica
 */
function createAuthService({ authRepository, hasher, tokens, politica }) {
  // Hash de relleno: si el usuario no existe se compara igual, para que el tiempo de
  // respuesta no revele qué correos o celulares están registrados.
  let hashRelleno;
  const obtenerHashRelleno = async () => (hashRelleno ??= await hasher.hash('relleno-sin-cuenta-0'));

  function sesionPara(usuario) {
    return { ...tokens.firmar(usuario), usuario: usuarioPublico(usuario) };
  }

  return {
    async registrar(body) {
      const datos = validarRegistro(body);
      const contrasenaHash = await hasher.hash(datos.contrasena);
      try {
        const usuario = await authRepository.crearCuenta(
          { ...datos, contrasenaHash },
          { versionAviso: politica.versionAvisoPrivacidad },
        );
        return sesionPara(usuario); // CU-01 paso 4: la sesión queda abierta
      } catch (err) {
        // CU-01 A1: correo o celular ya registrado.
        if (err.code === '23505' && RESTRICCION_A_CAMPO[err.constraint]) {
          throw errores.cuentaExistente(RESTRICCION_A_CAMPO[err.constraint]);
        }
        throw err;
      }
    },

    async iniciarSesion(body) {
      const { identificador, contrasena } = validarSesion(body);
      const usuario = identificador.tipo === 'correo'
        ? await authRepository.buscarPorCorreo(identificador.valor)
        : await authRepository.buscarPorTelefono(identificador.valor);

      if (!usuario) {
        await hasher.comparar(contrasena, await obtenerHashRelleno());
        await authRepository.registrarBitacora({ accion: 'INICIO_SESION', resultado: 'FALLIDO' });
        throw errores.credencialesInvalidas();
      }

      const id = usuario.id_usuario;

      // CU-21 paso 2: mientras dure el bloqueo no se evalúa la contraseña.
      if (usuario.bloqueado) {
        await authRepository.registrarBitacora({ idUsuario: id, accion: 'INICIO_SESION', resultado: 'BLOQUEADO' });
        throw errores.cuentaBloqueada(usuario.bloqueado_hasta);
      }

      const valida = await hasher.comparar(contrasena, usuario.contrasena_hash);
      if (!valida) {
        const intento = await authRepository.registrarIntentoFallido(id, politica);
        await authRepository.registrarBitacora({ idUsuario: id, accion: 'INICIO_SESION', resultado: 'FALLIDO' });
        if (intento.bloqueado) {
          // CU-21 A1: quinto intento fallido → bloqueo de 15 minutos registrado en bitácora.
          await authRepository.registrarBitacora({ idUsuario: id, accion: 'BLOQUEO_CUENTA', resultado: 'EXITOSO' });
          throw errores.cuentaBloqueada(
            intento.bloqueado_hasta,
            `Credenciales inválidas. Por seguridad la cuenta quedó bloqueada ${politica.minutosBloqueo} minutos.`,
          );
        }
        throw errores.credencialesInvalidas();
      }

      // CU-21 A2: la cuenta solo se informa como suspendida a quien conoce la contraseña.
      if (usuario.estado !== 'ACTIVA') {
        await authRepository.registrarBitacora({ idUsuario: id, accion: 'INICIO_SESION', resultado: 'RECHAZADO' });
        throw errores.cuentaSuspendida();
      }

      if (usuario.intentos_fallidos > 0 || usuario.bloqueado_hasta) await authRepository.reiniciarIntentos(id);
      await authRepository.registrarBitacora({ idUsuario: id, accion: 'INICIO_SESION', resultado: 'EXITOSO' });
      return sesionPara(usuario);
    },

    /** Perfil del usuario autenticado; la app lo usa para validar el token guardado. */
    async perfil(idUsuario) {
      const usuario = await authRepository.buscarPorId(idUsuario);
      if (!usuario || usuario.estado !== 'ACTIVA') throw errores.sesionExpirada();
      return { usuario: usuarioPublico(usuario) };
    },
  };
}

module.exports = { createAuthService, usuarioPublico };
