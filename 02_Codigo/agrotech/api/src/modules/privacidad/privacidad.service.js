'use strict';

const { errores } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { registrarBitacora } = require('../../utils/bitacora');
const { perfilPublico } = require('../perfil/perfil.service');

const crypto = require('node:crypto');

/** Hash con formato Bcrypt que no corresponde a ninguna contraseña: la cuenta suprimida no puede volver a entrar. */
const ALFABETO_BCRYPT = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const hashInutilizable = () => `$2b$04$${[...crypto.randomBytes(53)].map((b) => ALFABETO_BCRYPT[b % 64]).join('')}`;

const DIAS_HABILES_PLAZO = 15; // Ley 1581 de 2012, art. 15 (reclamos): 15 días hábiles
const ACTIVOS = ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO'];

/** Suma días hábiles (lunes a viernes) a una fecha. Los festivos los revisa la asociación al responder. */
function sumarDiasHabiles(desde, dias) {
  const f = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  let n = 0;
  while (n < dias) {
    f.setUTCDate(f.getUTCDate() + 1);
    const d = f.getUTCDay();
    if (d !== 0 && d !== 6) n += 1;
  }
  return f.toISOString().slice(0, 10);
}

/** Lo que el usuario debe saber antes de pedir la supresión (CU-20 paso 3). */
const CONSECUENCIAS = Object.freeze([
  'Su cuenta se cierra y no podrá volver a ingresar con ella.',
  'Se borran su nombre, correo, celular, dirección, ubicación y foto.',
  'Sus publicaciones se retiran del catálogo.',
  'Los pedidos y pagos ya hechos se conservan sin su identificación (obligación contable).',
  'Si tiene pedidos en curso, la supresión se aplaza hasta que terminen.',
]);

/** Para qué se usa cada dato (Ley 1581: finalidad informada). */
const FINALIDADES = Object.freeze([
  { dato: 'Nombre y apellidos', finalidad: 'Identificarlo ante la otra parte de un pedido (se muestra solo el nombre y la inicial del apellido).' },
  { dato: 'Correo', finalidad: 'Iniciar sesión y recuperar la contraseña.' },
  { dato: 'Celular', finalidad: 'Iniciar sesión. No se muestra a otros usuarios: la comunicación es por el chat del pedido.' },
  { dato: 'Municipio, vereda y ubicación', finalidad: 'Filtrar el catálogo y ordenar por cercanía.' },
]);

const solicitudPublica = (s) => (s ? {
  id: s.id_solicitud, estado: s.estado, motivo: s.motivo, fechaSolicitud: s.fecha_solicitud,
  fechaLimite: s.fecha_limite instanceof Date ? s.fecha_limite.toISOString().slice(0, 10) : s.fecha_limite,
  fechaResolucion: s.fecha_resolucion, observacion: s.observacion,
} : null);

/**
 * CU-20 · Gestionar datos personales (RF-20 · Ley 1581 de 2012).
 * Consultar datos y autorizaciones; corregir (CU-09); solicitar la supresión, que anonimiza la cuenta
 * y conserva las transacciones sin identificación. A1: con pedidos en curso se aplaza. A2: desistir.
 */
function createPrivacidadService({ pool, almacenFotos, correo, perfilRepository, versionAviso, eventos }) {
  const emitir = (e, d) => { if (eventos) eventos.emit(e, d); };

  async function pedidosEnCurso(db, idUsuario) {
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM pedido WHERE (id_consumidor = $1 OR id_productor = $1) AND estado = ANY($2::estado_pedido[])',
      [idUsuario, ACTIVOS],
    );
    return rows[0].n;
  }

  async function solicitudAbierta(db, idUsuario, { bloquear = false } = {}) {
    const { rows } = await db.query(
      `SELECT * FROM solicitud_supresion WHERE id_usuario = $1 AND estado IN ('PENDIENTE', 'APLAZADA') ${bloquear ? 'FOR UPDATE' : ''}`,
      [idUsuario],
    );
    return rows[0] || null;
  }

  /**
   * CU-20 paso 4. Dentro de la transacción del llamador:
   * datos personales reemplazados, cuenta inhabilitada, sesiones cerradas, publicaciones retiradas,
   * mensajes y comentarios propios borrados; pedidos y pagos se conservan sin identificación.
   */
  async function anonimizar(db, idUsuario) {
    const sufijo = idUsuario.replace(/-/g, '');
    const { rows: [u] } = await db.query('SELECT correo, nombres, foto_url FROM usuario WHERE id_usuario = $1 FOR UPDATE', [idUsuario]);
    await db.query(
      `UPDATE usuario SET nombres = 'Usuario', apellidos = 'Anónimo', correo = $2, telefono = $3,
              contrasena_hash = $4, vereda_direccion = NULL, coordenadas = NULL, foto_url = NULL,
              estado = 'ANONIMIZADA', version_sesion = version_sesion + 1, verificado = false
       WHERE id_usuario = $1`,
      [idUsuario, `anonimo.${sufijo}@agrotech.invalid`, `ANON${sufijo.slice(0, 16)}`, hashInutilizable()],
    );
    await db.query("UPDATE producto SET estado = 'INACTIVA' WHERE id_productor = $1 AND estado <> 'INACTIVA'", [idUsuario]);
    await db.query("UPDATE mensaje SET contenido = '[Mensaje eliminado por solicitud del titular]' WHERE id_emisor = $1", [idUsuario]);
    await db.query(
      'UPDATE calificacion c SET comentario = NULL FROM pedido p WHERE p.id_pedido = c.id_pedido AND p.id_consumidor = $1',
      [idUsuario],
    );
    await db.query("UPDATE pedido SET punto_entrega = 'Dato suprimido' WHERE id_consumidor = $1", [idUsuario]);
    await db.query("UPDATE dispositivo SET estado = 'INVALIDO' WHERE id_usuario = $1", [idUsuario]);
    await db.query('DELETE FROM notificacion WHERE id_usuario = $1', [idUsuario]);
    await db.query('UPDATE recuperacion_contrasena SET invalidado_en = now() WHERE id_usuario = $1 AND usado_en IS NULL AND invalidado_en IS NULL', [idUsuario]);
    await registrarBitacora(db, { idUsuario, accion: 'SUPRESION_DATOS', idEntidad: idUsuario, resultado: 'ANONIMIZADA' });
    return u;
  }

  async function avisarSupresion(u) {
    if (u.foto_url) almacenFotos.eliminar(u.foto_url).catch(() => {});
    if (!correo) return;
    await correo.enviar({
      para: u.correo,
      asunto: 'AgroTech · Sus datos personales fueron suprimidos',
      texto: `Hola, ${u.nombres}.\n\nAtendimos su solicitud: su cuenta de AgroTech quedó cerrada y sus datos personales fueron suprimidos. `
        + 'Los pedidos ya hechos se conservan sin su identificación, como exige la ley contable.\n\nGracias por haber usado AgroTech.',
    }).catch((err) => console.error('[correo] supresión:', err.message));
  }

  return {
    CONSECUENCIAS,

    /** CU-20 paso 1: datos, autorizaciones otorgadas y estado de la solicitud de supresión. */
    async consultar({ usuario, baseFotos }) {
      const perfil = await perfilRepository.buscar(usuario.id);
      if (!perfil) throw errores.noEncontrado('La cuenta no existe.');
      const { rows: autorizaciones } = await pool.query(
        'SELECT version_aviso, canal, fecha_aceptacion FROM autorizacion_datos WHERE id_usuario = $1 ORDER BY fecha_aceptacion DESC',
        [usuario.id],
      );
      const { rows: [ultima] } = await pool.query(
        'SELECT * FROM solicitud_supresion WHERE id_usuario = $1 ORDER BY fecha_solicitud DESC LIMIT 1', [usuario.id],
      );
      return {
        datos: perfilPublico(perfil, almacenFotos, baseFotos),
        finalidades: FINALIDADES,
        autorizaciones: autorizaciones.map((a) => ({ version: a.version_aviso, canal: a.canal, fecha: a.fecha_aceptacion })),
        avisoVigente: versionAviso,
        supresion: { solicitud: solicitudPublica(ultima), consecuencias: CONSECUENCIAS, plazoDiasHabiles: DIAS_HABILES_PLAZO },
        pedidosEnCurso: await pedidosEnCurso(pool, usuario.id),
      };
    },

    /**
     * CU-20 pasos 3-4. Exige confirmar (la app mostró las consecuencias).
     * Sin pedidos en curso se ejecuta enseguida (COMPLETADA); con pedidos en curso queda APLAZADA (A1).
     */
    async solicitarSupresion({ usuario, body = {} }) {
      if (body.confirmar !== true) {
        throw errores.datosInvalidos('Confirme que leyó las consecuencias de suprimir sus datos.', { consecuencias: CONSECUENCIAS });
      }
      const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 300) || null : null;
      const r = await transaccion(pool, async (db) => {
        if (await solicitudAbierta(db, usuario.id, { bloquear: true })) {
          throw errores.conflicto('SOLICITUD_EN_TRAMITE', 'Ya tiene una solicitud de supresión en trámite.');
        }
        const enCurso = await pedidosEnCurso(db, usuario.id);
        const fechaLimite = sumarDiasHabiles(new Date(), DIAS_HABILES_PLAZO);
        const aplazar = enCurso > 0;
        const { rows: [s] } = await db.query(
          `INSERT INTO solicitud_supresion (id_usuario, estado, motivo, fecha_limite, observacion, fecha_resolucion)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [usuario.id, aplazar ? 'APLAZADA' : 'COMPLETADA', motivo, fechaLimite,
            aplazar ? `Aplazada: tiene ${enCurso} pedido(s) en curso. Se completará cuando terminen.` : 'Datos anonimizados.',
            aplazar ? null : new Date()],
        );
        await registrarBitacora(db, { idUsuario: usuario.id, accion: 'SOLICITUD_SUPRESION', entidad: 'SOLICITUD_SUPRESION', idEntidad: s.id_solicitud, resultado: s.estado });
        const datosPrevios = aplazar ? null : await anonimizar(db, usuario.id);
        return { s, datosPrevios };
      });
      if (r.datosPrevios) await avisarSupresion(r.datosPrevios);
      return { solicitud: solicitudPublica(r.s), sesionCerrada: !!r.datosPrevios };
    },

    /** CU-20 A2: el usuario desiste mientras la solicitud está en trámite. */
    async desistir({ usuario }) {
      return transaccion(pool, async (db) => {
        const s = await solicitudAbierta(db, usuario.id, { bloquear: true });
        if (!s) throw errores.noEncontrado('No tiene una solicitud de supresión en trámite.');
        const { rows: [d] } = await db.query(
          "UPDATE solicitud_supresion SET estado = 'DESISTIDA', fecha_resolucion = now(), observacion = 'El titular desistió.' WHERE id_solicitud = $1 RETURNING *",
          [s.id_solicitud],
        );
        await registrarBitacora(db, { idUsuario: usuario.id, accion: 'SOLICITUD_SUPRESION', entidad: 'SOLICITUD_SUPRESION', idEntidad: s.id_solicitud, resultado: 'DESISTIDA' });
        return { solicitud: solicitudPublica(d) };
      });
    },

    /** Tarea programada (cada hora): completa las solicitudes aplazadas cuyos pedidos ya terminaron. */
    async procesarAplazadas() {
      const { rows } = await pool.query("SELECT id_solicitud, id_usuario FROM solicitud_supresion WHERE estado = 'APLAZADA' ORDER BY fecha_solicitud");
      const completadas = [];
      for (const s of rows) {
        const previos = await transaccion(pool, async (db) => {
          const vigente = await solicitudAbierta(db, s.id_usuario, { bloquear: true });
          if (!vigente || vigente.estado !== 'APLAZADA' || await pedidosEnCurso(db, s.id_usuario) > 0) return null;
          await db.query("UPDATE solicitud_supresion SET estado = 'COMPLETADA', fecha_resolucion = now(), observacion = 'Datos anonimizados al terminar los pedidos en curso.' WHERE id_solicitud = $1", [s.id_solicitud]);
          return anonimizar(db, s.id_usuario);
        });
        if (previos) {
          completadas.push(s.id_solicitud);
          await avisarSupresion(previos);
          emitir('cuenta_cerrada', { idUsuario: s.id_usuario });
        }
      }
      return completadas;
    },

    anonimizar,
  };
}

module.exports = { createPrivacidadService, sumarDiasHabiles, CONSECUENCIAS };
