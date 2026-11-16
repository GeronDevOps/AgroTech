'use strict';

const crypto = require('node:crypto');
const { errores, HttpError } = require('../../utils/http-error');
const { validarRegistro, validarSesion, validarSolicitudRecuperacion, validarRestablecimiento } = require('./auth.validacion');

/** CU-08 paso 2: respuesta idéntica exista o no la cuenta (A1). */
const MENSAJE_RECUPERACION = 'Si el correo está registrado, le enviamos un código de 6 dígitos. Revise su bandeja de entrada (y la de correo no deseado). El código vence en 15 minutos.';
const hashCodigo = (idUsuario, codigo) => crypto.createHash('sha256').update(`${idUsuario}:${codigo}`).digest('hex');
const errorCodigo = (codigo, mensaje, detalles) => new HttpError(400, codigo, mensaje, detalles);

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
function createAuthService({ authRepository, hasher, tokens, politica, correo, recuperacion = { minutosVigencia: 15, intentosMaximos: 3, segundosEntreEnvios: 60 } }) {
  // Hash de relleno: si el usuario no existe se compara igual, para que el tiempo de
  // respuesta no revele qué correos o celulares están registrados.
  const correoSaliente = correo;
  let hashRelleno;
  const obtenerHashRelleno = async () => (hashRelleno ??= await hasher.hash('relleno-sin-cuenta-0'));

  // CU-20 A3: si cambió el aviso de privacidad, la app pide aceptar la versión nueva antes de seguir.
  const requiereAutorizacion = (u) => Boolean(u.version_aviso_aceptada) && u.version_aviso_aceptada !== politica.versionAvisoPrivacidad;

  function sesionPara(usuario) {
    return {
      ...tokens.firmar(usuario),
      usuario: usuarioPublico(usuario),
      requiereAutorizacion: requiereAutorizacion(usuario),
      versionAviso: politica.versionAvisoPrivacidad,
    };
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
      return { usuario: usuarioPublico(usuario), requiereAutorizacion: requiereAutorizacion(usuario), versionAviso: politica.versionAvisoPrivacidad };
    },

    /**
     * CU-08 pasos 1-2. Respuesta neutra siempre (A1). Solo las cuentas activas reciben código.
     * Un código nuevo invalida el anterior; no se reenvía más de uno por minuto (protege el buzón del usuario).
     * El correo sale sin esperar su entrega: el tiempo de respuesta no revela si la cuenta existe.
     */
    async recuperar(body) {
      const { correo } = validarSolicitudRecuperacion(body);
      const usuario = await authRepository.buscarPorCorreo(correo);
      if (usuario && usuario.estado === 'ACTIVA') {
        const desde = await authRepository.segundosDesdeUltimoCodigo(usuario.id_usuario);
        if (desde === null || desde >= recuperacion.segundosEntreEnvios) {
          const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
          await authRepository.crearCodigo(usuario.id_usuario, hashCodigo(usuario.id_usuario, codigo), recuperacion.minutosVigencia);
          if (correoSaliente) {
            Promise.resolve(correoSaliente.enviar({
              para: usuario.correo,
              asunto: `AgroTech · Código para cambiar su contraseña: ${codigo}`,
              texto: `Hola, ${usuario.nombres}.\n\nSu código para cambiar la contraseña de AgroTech es: ${codigo}\n\n`
                + `Vence en ${recuperacion.minutosVigencia} minutos y sirve una sola vez. Si usted no lo pidió, ignore este correo: su contraseña no cambia.`,
            })).catch((err) => console.error('[correo] recuperación:', err.message));
          }
        }
      } else {
        await authRepository.registrarBitacora({ accion: 'RECUPERAR_CONTRASENA', resultado: 'SIN_CUENTA' });
      }
      return { mensaje: MENSAJE_RECUPERACION, minutosVigencia: recuperacion.minutosVigencia };
    },

    /**
     * CU-08 pasos 3-4. Código de un solo uso, 15 minutos, máximo 3 intentos (A2); contraseña con la política (A3).
     * Al cambiarla se cierran todas las sesiones anteriores y se devuelve una sesión nueva en este teléfono.
     */
    async restablecer(body) {
      const d = validarRestablecimiento(body);
      const usuario = await authRepository.buscarPorCorreo(d.correo);
      const invalido = () => errorCodigo('CODIGO_INVALIDO', 'El código no es válido o ya venció. Solicite uno nuevo.');
      if (!usuario || usuario.estado !== 'ACTIVA') throw invalido();
      const contrasenaHash = await hasher.hash(d.contrasena);

      const r = await authRepository.conCodigoVigente(usuario.id_usuario, async (db, vigente) => {
        if (!vigente) return { error: invalido() };
        if (vigente.vencido) {
          await authRepository.invalidarCodigo(db, vigente.id_recuperacion);
          return { error: errorCodigo('CODIGO_VENCIDO', 'El código venció (dura 15 minutos). Solicite uno nuevo.') };
        }
        const esperado = Buffer.from(vigente.codigo_hash, 'hex');
        const recibido = Buffer.from(hashCodigo(usuario.id_usuario, d.codigo), 'hex');
        if (!crypto.timingSafeEqual(esperado, recibido)) {
          const agotado = vigente.intentos + 1 >= recuperacion.intentosMaximos;
          await authRepository.sumarIntentoCodigo(db, vigente.id_recuperacion, agotado);
          return {
            error: agotado
              ? errorCodigo('CODIGO_AGOTADO', `Superó los ${recuperacion.intentosMaximos} intentos. Solicite un código nuevo.`)
              : errorCodigo('CODIGO_INCORRECTO', 'El código no coincide. Revíselo e intente de nuevo.', { intentosRestantes: recuperacion.intentosMaximos - vigente.intentos - 1 }),
          };
        }
        return { usuario: await authRepository.cambiarContrasena(db, { idUsuario: usuario.id_usuario, idRecuperacion: vigente.id_recuperacion, contrasenaHash }) };
      });
      if (r.error) throw r.error;
      return { mensaje: 'Contraseña cambiada. Por seguridad se cerraron las sesiones abiertas en otros teléfonos.', ...sesionPara(r.usuario) };
    },

    /** CU-20 A3: el usuario acepta la versión vigente del aviso de privacidad. */
    async aceptarAviso(idUsuario, body = {}) {
      if (body.version !== politica.versionAvisoPrivacidad) {
        throw errores.datosInvalidos('Acepte la versión vigente del aviso de privacidad.', { versionVigente: politica.versionAvisoPrivacidad });
      }
      await authRepository.aceptarAviso(idUsuario, politica.versionAvisoPrivacidad);
      return this.perfil(idUsuario);
    },
  };
}

module.exports = { createAuthService, usuarioPublico };
