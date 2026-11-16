'use strict';

const { errores } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { registrarBitacora } = require('../../utils/bitacora');
const { esUuid } = require('../productos/productos.validacion');
const { reportePublico, MOTIVOS } = require('../reportes/reportes.service');
const { createPedidosRepository } = require('../pedidos/pedidos.repository');

const ACTIVOS = "('PENDIENTE', 'ACEPTADO', 'EN_CAMINO')";
const DECISIONES = ['DESESTIMAR', 'OCULTAR', 'SUSPENDER'];
const MOTIVO_CANCELACION_SUSPENSION = 'Cuenta suspendida por la administración';
const texto = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

const usuarioAdmin = (u) => ({
  id: u.id_usuario,
  nombres: u.nombres,
  apellidos: u.apellidos,
  correo: u.correo,
  telefono: u.telefono,
  rol: u.rol,
  municipio: u.municipio,
  estado: u.estado,
  motivoEstado: u.motivo_estado,
  verificado: u.verificado,
  fechaRegistro: u.fecha_registro,
  ...(u.reportes_recibidos !== undefined ? {
    historial: {
      reportesRecibidos: u.reportes_recibidos,
      reportesConfirmados: u.reportes_confirmados,
      pedidosEnCurso: u.pedidos_en_curso,
      pedidosCancelados: u.pedidos_cancelados,
      pedidosEntregados: u.pedidos_entregados,
      calificacion: u.promedio === null || u.promedio === undefined ? null : { promedio: Number(u.promedio), total: u.total_calificaciones },
      reportesHechos: u.reportes_hechos,
      reportesMalintencionados: u.reportes_malintencionados,
    },
  } : {}),
});

const SELECT_USUARIO_HISTORIAL = `
  SELECT u.*,
    (SELECT count(*)::int FROM reporte r WHERE r.id_reportado = u.id_usuario) AS reportes_recibidos,
    (SELECT count(*)::int FROM reporte r WHERE r.id_reportado = u.id_usuario AND r.estado = 'RESUELTO') AS reportes_confirmados,
    (SELECT count(*)::int FROM reporte r WHERE r.id_reportante = u.id_usuario) AS reportes_hechos,
    (SELECT count(*)::int FROM reporte r WHERE r.id_reportante = u.id_usuario AND r.malintencionado) AS reportes_malintencionados,
    (SELECT count(*)::int FROM pedido p WHERE (p.id_consumidor = u.id_usuario OR p.id_productor = u.id_usuario) AND p.estado IN ${ACTIVOS}) AS pedidos_en_curso,
    (SELECT count(*)::int FROM pedido p WHERE (p.id_consumidor = u.id_usuario OR p.id_productor = u.id_usuario) AND p.estado = 'CANCELADO') AS pedidos_cancelados,
    (SELECT count(*)::int FROM pedido p WHERE (p.id_consumidor = u.id_usuario OR p.id_productor = u.id_usuario) AND p.estado = 'ENTREGADO') AS pedidos_entregados,
    rp.promedio, rp.total_calificaciones::int AS total_calificaciones
  FROM usuario u LEFT JOIN v_reputacion_productor rp ON rp.id_productor = u.id_usuario`;

/**
 * CU-18 · Administrar y moderar (RF-18) desde el panel web.
 * Revisa reportes (con el contenido y el historial del usuario), decide desestimar, ocultar o suspender,
 * verifica productores y suspende o reactiva cuentas. Toda medida queda en bitácora y se notifica (paso 3).
 */
function createAdminService({ pool, eventos, correo, almacenFotos }) {
  const pedidosRepo = createPedidosRepository({ pool });
  const emitir = (e, d) => { if (eventos) eventos.emit(e, d); };
  const avisar = (idUsuario, tipo, titulo, cuerpo, datos = {}) => emitir('aviso_usuario', { idUsuario, tipo, titulo, cuerpo, datos });

  async function contenido(db, r, baseFotos) {
    if (r.tipo_contenido === 'PRODUCTO') {
      const { rows: [p] } = await db.query('SELECT id_producto, nombre, descripcion, categoria, precio, unidad_medida, stock, municipio, estado, foto_url FROM producto WHERE id_producto = $1', [r.id_contenido]);
      return p ? {
        tipo: 'PRODUCTO', id: p.id_producto, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria, precio: Number(p.precio),
        unidad: p.unidad_medida, stock: Number(p.stock), municipio: p.municipio, estado: p.estado,
        miniaturaUrl: almacenFotos ? almacenFotos.urlPublica(p.foto_url.replace(/\.jpg$/, '_min.jpg'), baseFotos) : null,
      } : null;
    }
    if (r.tipo_contenido === 'CALIFICACION') {
      const { rows: [c] } = await db.query('SELECT id_calificacion, puntuacion, comentario, oculta, fecha FROM calificacion WHERE id_calificacion = $1', [r.id_contenido]);
      return c ? { tipo: 'CALIFICACION', id: c.id_calificacion, puntuacion: c.puntuacion, comentario: c.comentario, oculta: c.oculta, fecha: c.fecha } : null;
    }
    const { rows: [p] } = await db.query('SELECT id_pedido, estado, total, fecha, motivo_cancelacion FROM pedido WHERE id_pedido = $1', [r.id_contenido]);
    return p ? { tipo: 'PEDIDO', id: p.id_pedido, estado: p.estado, total: Number(p.total), fecha: p.fecha, motivoCancelacion: p.motivo_cancelacion } : null;
  }

  async function usuarioConHistorial(db, id) {
    const { rows } = await db.query(`${SELECT_USUARIO_HISTORIAL} WHERE u.id_usuario = $1`, [id]);
    return rows[0] || null;
  }

  /**
   * Suspende la cuenta dentro de la transacción del llamador: cierra sus sesiones (version_sesion + 1)
   * y cancela sus pedidos en curso con restitución del inventario. Devuelve los pedidos cancelados.
   */
  async function suspenderEn(db, { admin, idUsuario, motivo }) {
    await db.query(
      "UPDATE usuario SET estado = 'SUSPENDIDA', motivo_estado = $2, version_sesion = version_sesion + 1 WHERE id_usuario = $1",
      [idUsuario, motivo.slice(0, 200)],
    );
    const { rows } = await db.query(
      `SELECT id_pedido, estado FROM pedido WHERE (id_consumidor = $1 OR id_productor = $1) AND estado IN ${ACTIVOS} ORDER BY id_pedido FOR UPDATE`,
      [idUsuario],
    );
    for (const p of rows) {
      await pedidosRepo.actualizarEstado(db, p.id_pedido, { estado: 'CANCELADO', motivo: MOTIVO_CANCELACION_SUSPENSION });
      for (const linea of await pedidosRepo.detalleDe(db, p.id_pedido)) await pedidosRepo.moverStock(db, linea.id_producto, -Number(linea.cantidad));
      await pedidosRepo.anularPagoPendiente(db, p.id_pedido);
      await pedidosRepo.registrarHistorial(db, { idPedido: p.id_pedido, idUsuario: admin.id, anterior: p.estado, nuevo: 'CANCELADO' });
    }
    await registrarBitacora(db, { idUsuario: admin.id, accion: 'CUENTA_SUSPENDIDA', idEntidad: idUsuario, resultado: rows.length ? `${rows.length}_PEDIDOS_CANC` : 'EXITOSO' });
    return rows.map((p) => p.id_pedido);
  }

  function despuesDeSuspender(idUsuario, motivo, pedidosCancelados, correoUsuario, nombre) {
    pedidosCancelados.forEach((idPedido) => emitir('estado_pedido', { idPedido, estado: 'CANCELADO', porUsuario: idUsuario }));
    emitir('cuenta_cerrada', { idUsuario });
    if (correo && correoUsuario) {
      correo.enviar({
        para: correoUsuario,
        asunto: 'AgroTech · Su cuenta fue suspendida',
        texto: `Hola, ${nombre}.\n\nSu cuenta de AgroTech fue suspendida por la administración. Motivo: ${motivo}\n\nSi cree que es un error, comuníquese con la asociación.`,
      }).catch((err) => console.error('[correo] suspensión:', err.message));
    }
  }

  async function exigirConfirmacionSiHayPedidos(db, idUsuario, confirmar) {
    const { rows: [c] } = await db.query(
      `SELECT count(*)::int AS n FROM pedido WHERE (id_consumidor = $1 OR id_productor = $1) AND estado IN ${ACTIVOS}`, [idUsuario],
    );
    // A2: con pedidos en curso se pide confirmación antes de suspender (y esos pedidos se cancelan).
    if (c.n > 0 && confirmar !== true) {
      throw errores.conflicto('REQUIERE_CONFIRMACION', `La cuenta tiene ${c.n === 1 ? 'un pedido' : `${c.n} pedidos`} en curso. Si confirma, se cancelarán y se avisará a la otra parte.`, { pedidosEnCurso: c.n });
    }
  }

  return {
    DECISIONES,

    async resumen() {
      const { rows: [r] } = await pool.query(`SELECT
        (SELECT count(*)::int FROM reporte WHERE estado IN ('PENDIENTE', 'EN_REVISION')) AS reportes_abiertos,
        (SELECT count(*)::int FROM usuario WHERE rol = 'PRODUCTOR' AND estado = 'ACTIVA' AND NOT verificado) AS productores_por_verificar,
        (SELECT count(*)::int FROM usuario WHERE estado = 'SUSPENDIDA') AS cuentas_suspendidas,
        (SELECT count(*)::int FROM solicitud_supresion WHERE estado IN ('PENDIENTE', 'APLAZADA')) AS supresiones_en_tramite,
        (SELECT count(*)::int FROM usuario WHERE rol = 'PRODUCTOR' AND estado = 'ACTIVA') AS productores,
        (SELECT count(*)::int FROM usuario WHERE rol = 'CONSUMIDOR' AND estado = 'ACTIVA') AS consumidores,
        (SELECT count(*)::int FROM producto WHERE estado = 'ACTIVA') AS publicaciones_activas,
        (SELECT count(*)::int FROM pedido WHERE estado IN ${ACTIVOS}) AS pedidos_en_curso`);
      return {
        reportesAbiertos: r.reportes_abiertos, productoresPorVerificar: r.productores_por_verificar, cuentasSuspendidas: r.cuentas_suspendidas,
        supresionesEnTramite: r.supresiones_en_tramite, productores: r.productores, consumidores: r.consumidores,
        publicacionesActivas: r.publicaciones_activas, pedidosEnCurso: r.pedidos_en_curso,
      };
    },

    /** CU-18 paso 1: reportes (por defecto los abiertos), del más antiguo al más reciente. */
    async reportes({ query = {} }) {
      const estado = String(query.estado || 'abiertos').toUpperCase();
      const filtros = { ABIERTOS: ['PENDIENTE', 'EN_REVISION'], PENDIENTE: ['PENDIENTE'], EN_REVISION: ['EN_REVISION'], RESUELTO: ['RESUELTO'], DESESTIMADO: ['DESESTIMADO'], TODOS: ['PENDIENTE', 'EN_REVISION', 'RESUELTO', 'DESESTIMADO'] };
      if (!filtros[estado]) throw errores.datosInvalidos('Estado inválido.');
      const { rows } = await pool.query(
        `SELECT r.*, ur.nombres || ' ' || ur.apellidos AS reportante, ud.nombres || ' ' || ud.apellidos AS reportado,
                (SELECT count(*)::int FROM reporte o WHERE o.tipo_contenido = r.tipo_contenido AND o.id_contenido = r.id_contenido) AS reportes_del_contenido
         FROM reporte r JOIN usuario ur ON ur.id_usuario = r.id_reportante LEFT JOIN usuario ud ON ud.id_usuario = r.id_reportado
         WHERE r.estado = ANY($1::estado_reporte[]) ORDER BY r.fecha LIMIT 100`,
        [filtros[estado]],
      );
      return {
        reportes: rows.map((r) => ({ ...reportePublico(r), reportante: r.reportante, reportado: r.reportado, reportesDelContenido: r.reportes_del_contenido })),
        motivos: MOTIVOS,
      };
    },

    /** CU-18 paso 2: contenido reportado e historial de ambas partes. Al abrirlo pasa a EN_REVISION. */
    async reporte({ admin, id, baseFotos }) {
      if (!esUuid(id)) throw errores.noEncontrado('El reporte no existe.');
      return transaccion(pool, async (db) => {
        const { rows: [r] } = await db.query('SELECT * FROM reporte WHERE id_reporte = $1 FOR UPDATE', [id]);
        if (!r) throw errores.noEncontrado('El reporte no existe.');
        if (r.estado === 'PENDIENTE') {
          await db.query("UPDATE reporte SET estado = 'EN_REVISION', id_administrador = $2 WHERE id_reporte = $1", [id, admin.id]);
          r.estado = 'EN_REVISION';
        }
        const reportado = r.id_reportado ? await usuarioConHistorial(db, r.id_reportado) : null;
        const reportante = await usuarioConHistorial(db, r.id_reportante);
        return {
          reporte: reportePublico(r),
          contenido: await contenido(db, r, baseFotos),
          reportado: reportado ? usuarioAdmin(reportado) : null,
          reportante: usuarioAdmin(reportante),
          decisionesPosibles: r.tipo_contenido === 'PEDIDO' ? ['DESESTIMAR', 'SUSPENDER'] : DECISIONES,
        };
      });
    },

    /**
     * CU-18 pasos 2-3. DESESTIMAR (A1: si es malintencionado se advierte al reportante), OCULTAR (publicación
     * o comentario) o SUSPENDER al autor (A2: confirmación si tiene pedidos en curso). Cierra también los
     * demás reportes abiertos del mismo contenido y avisa a los reportantes (CU-19 paso 4) y al afectado.
     */
    async resolver({ admin, id, body = {} }) {
      const decision = String(body.decision || '').toUpperCase();
      const resolucion = texto(body.resolucion);
      const errs = {};
      if (!DECISIONES.includes(decision)) errs.decision = 'Elija desestimar, ocultar o suspender.';
      if (resolucion.length < 5 || resolucion.length > 300) errs.resolucion = 'Explique la decisión (5 a 300 caracteres).';
      if (Object.keys(errs).length) throw errores.datosInvalidos('Revise la decisión.', { campos: errs });
      if (!esUuid(id)) throw errores.noEncontrado('El reporte no existe.');

      const r = await transaccion(pool, async (db) => {
        const { rows: [rep] } = await db.query('SELECT * FROM reporte WHERE id_reporte = $1 FOR UPDATE', [id]);
        if (!rep) throw errores.noEncontrado('El reporte no existe.');
        if (['RESUELTO', 'DESESTIMADO'].includes(rep.estado)) throw errores.conflicto('REPORTE_RESUELTO', 'El reporte ya fue resuelto.');
        if (decision === 'OCULTAR' && rep.tipo_contenido === 'PEDIDO') throw errores.datosInvalidos('Un pedido no se puede ocultar: desestime el reporte o suspenda la cuenta.');

        let afectado = null;
        let pedidosCancelados = [];
        if (decision === 'OCULTAR') {
          if (rep.tipo_contenido === 'PRODUCTO') await db.query("UPDATE producto SET estado = 'INACTIVA' WHERE id_producto = $1", [rep.id_contenido]);
          else await db.query('UPDATE calificacion SET oculta = true WHERE id_calificacion = $1', [rep.id_contenido]);
          afectado = rep.id_reportado;
        }
        if (decision === 'SUSPENDER') {
          if (!rep.id_reportado) throw errores.conflicto('SIN_AUTOR', 'El contenido no tiene un autor que suspender.');
          const { rows: [u] } = await db.query('SELECT id_usuario, estado, rol, correo, nombres FROM usuario WHERE id_usuario = $1 FOR UPDATE', [rep.id_reportado]);
          if (u.rol === 'ADMINISTRADOR') throw errores.sinPermiso('No se puede suspender a un administrador.');
          if (u.estado === 'ACTIVA') {
            await exigirConfirmacionSiHayPedidos(db, u.id_usuario, body.confirmar);
            pedidosCancelados = await suspenderEn(db, { admin, idUsuario: u.id_usuario, motivo: resolucion });
            afectado = { ...u, suspendido: true };
          }
        }
        const estado = decision === 'DESESTIMAR' ? 'DESESTIMADO' : 'RESUELTO';
        const malintencionado = decision === 'DESESTIMAR' && body.malintencionado === true;
        const { rows: cerrados } = await db.query(
          `UPDATE reporte SET estado = $3, decision = $4, resolucion = $5, id_administrador = $6, fecha_resolucion = now(),
                  malintencionado = (id_reporte = $1 AND $7)
           WHERE (id_reporte = $1 OR (tipo_contenido = $2 AND id_contenido = $8 AND estado IN ('PENDIENTE', 'EN_REVISION')))
           RETURNING *`,
          [id, rep.tipo_contenido, estado, decision, resolucion, admin.id, malintencionado, rep.id_contenido],
        );
        await registrarBitacora(db, { idUsuario: admin.id, accion: `MODERACION_${decision}`, entidad: 'REPORTE', idEntidad: id, resultado: malintencionado ? 'ADVERTENCIA' : estado });
        return { rep, cerrados, afectado, pedidosCancelados, malintencionado };
      });

      // Paso 3 y CU-19 paso 4: avisos después de confirmar.
      const tituloResultado = decision === 'DESESTIMAR' ? 'Reporte revisado' : 'Reporte atendido';
      for (const c of r.cerrados) {
        const advertencia = c.id_reporte === id && r.malintencionado;
        avisar(c.id_reportante, advertencia ? 'ADVERTENCIA' : 'REPORTE_RESUELTO',
          advertencia ? '⚠️ Advertencia sobre su reporte' : `🛡️ ${tituloResultado}`,
          advertencia
            ? `Su reporte se consideró malintencionado: ${resolucion} El uso indebido de los reportes puede llevar a la suspensión de la cuenta.`
            : `Revisamos su reporte (${MOTIVOS[c.motivo].toLowerCase()}). ${resolucion}`,
          { idReporte: c.id_reporte });
      }
      if (decision === 'OCULTAR' && r.afectado) {
        avisar(r.afectado, 'CONTENIDO_OCULTO', '🛡️ Contenido ocultado',
          `${r.rep.tipo_contenido === 'PRODUCTO' ? 'Una de sus publicaciones' : 'Uno de sus comentarios'} fue ocultado por incumplir las políticas: ${resolucion}`,
          { tipoContenido: r.rep.tipo_contenido, idContenido: r.rep.id_contenido });
      }
      if (decision === 'SUSPENDER' && r.afectado && r.afectado.suspendido) {
        despuesDeSuspender(r.afectado.id_usuario, resolucion, r.pedidosCancelados, r.afectado.correo, r.afectado.nombres);
      }
      return { reporte: reportePublico(r.cerrados.find((c) => c.id_reporte === id)), reportesCerrados: r.cerrados.length, pedidosCancelados: r.pedidosCancelados.length };
    },

    /** Usuarios con filtros: ?q (nombre, correo o celular) &rol &estado &verificado */
    async usuarios({ query = {} }) {
      const cond = ["u.rol <> 'ADMINISTRADOR'", "u.estado <> 'ANONIMIZADA'"];
      const params = [];
      const q = texto(query.q).replace(/[%_\\]/g, '');
      if (q) { params.push(`%${q}%`); cond.push(`(fn_texto_busqueda(u.nombres || ' ' || u.apellidos) LIKE fn_texto_busqueda($${params.length}) OR u.correo ILIKE $${params.length} OR u.telefono LIKE $${params.length})`); }
      if (query.rol) { params.push(String(query.rol).toUpperCase()); cond.push(`u.rol::text = $${params.length}`); }
      if (query.estado) { params.push(String(query.estado).toUpperCase()); cond.push(`u.estado::text = $${params.length}`); }
      if (query.verificado === 'true' || query.verificado === 'false') { params.push(query.verificado === 'true'); cond.push(`u.verificado = $${params.length}`); }
      const { rows } = await pool.query(`${SELECT_USUARIO_HISTORIAL} WHERE ${cond.join(' AND ')} ORDER BY u.fecha_registro DESC LIMIT 100`, params);
      return { usuarios: rows.map(usuarioAdmin) };
    },

    async usuario({ id }) {
      const u = esUuid(id) ? await usuarioConHistorial(pool, id) : null;
      if (!u || u.rol === 'ADMINISTRADOR') throw errores.noEncontrado('El usuario no existe.');
      const { rows: reportes } = await pool.query('SELECT * FROM reporte WHERE id_reportado = $1 ORDER BY fecha DESC LIMIT 20', [id]);
      return { usuario: usuarioAdmin(u), reportesRecibidos: reportes.map(reportePublico) };
    },

    /** CU-18 paso 4: marca (o desmarca) al productor como verificado tras revisar sus documentos con la asociación. */
    async verificar({ admin, id, body = {} }) {
      const verificado = body.verificado !== false;
      const { rows: [u] } = await pool.query(
        "UPDATE usuario SET verificado = $2 WHERE id_usuario = $1 AND rol = 'PRODUCTOR' AND estado = 'ACTIVA' RETURNING id_usuario",
        [esUuid(id) ? id : null, verificado],
      );
      if (!u) throw errores.noEncontrado('El productor no existe o no está activo.');
      await registrarBitacora(pool, { idUsuario: admin.id, accion: verificado ? 'PRODUCTOR_VERIFICADO' : 'VERIFICACION_RETIRADA', idEntidad: id });
      if (verificado) avisar(id, 'VERIFICADO', '✔️ Productor verificado', 'La asociación verificó su cuenta. Sus publicaciones ahora muestran el sello de verificado.');
      return this.usuario({ id });
    },

    /** Suspensión directa de una cuenta (A2: confirmación si tiene pedidos en curso). */
    async suspender({ admin, id, body = {} }) {
      const motivo = texto(body.motivo);
      if (motivo.length < 5 || motivo.length > 200) throw errores.datosInvalidos('Indique el motivo de la suspensión.', { campos: { motivo: '5 a 200 caracteres' } });
      if (!esUuid(id)) throw errores.noEncontrado('El usuario no existe.');
      const r = await transaccion(pool, async (db) => {
        const { rows: [u] } = await db.query('SELECT id_usuario, estado, rol, correo, nombres FROM usuario WHERE id_usuario = $1 FOR UPDATE', [id]);
        if (!u || u.rol === 'ADMINISTRADOR' || u.estado === 'ANONIMIZADA') throw errores.noEncontrado('El usuario no existe.');
        if (u.estado === 'SUSPENDIDA') throw errores.conflicto('YA_SUSPENDIDA', 'La cuenta ya está suspendida.');
        await exigirConfirmacionSiHayPedidos(db, id, body.confirmar);
        return { u, cancelados: await suspenderEn(db, { admin, idUsuario: id, motivo }) };
      });
      despuesDeSuspender(id, motivo, r.cancelados, r.u.correo, r.u.nombres);
      return { ...(await this.usuario({ id })), pedidosCancelados: r.cancelados.length };
    },

    async reactivar({ admin, id }) {
      const { rows: [u] } = await pool.query(
        "UPDATE usuario SET estado = 'ACTIVA', motivo_estado = NULL WHERE id_usuario = $1 AND estado = 'SUSPENDIDA' RETURNING id_usuario",
        [esUuid(id) ? id : null],
      );
      if (!u) throw errores.conflicto('NO_SUSPENDIDA', 'La cuenta no está suspendida.');
      await registrarBitacora(pool, { idUsuario: admin.id, accion: 'CUENTA_REACTIVADA', idEntidad: id });
      avisar(id, 'CUENTA_REACTIVADA', '✅ Cuenta reactivada', 'La asociación reactivó su cuenta. Ya puede volver a ingresar.');
      return this.usuario({ id });
    },

    /** Apoyo a CU-20: solicitudes de supresión en trámite con su plazo legal. */
    async supresiones() {
      const { rows } = await pool.query(
        `SELECT s.*, u.rol FROM solicitud_supresion s JOIN usuario u ON u.id_usuario = s.id_usuario
         ORDER BY (s.estado IN ('PENDIENTE', 'APLAZADA')) DESC, s.fecha_limite LIMIT 100`,
      );
      return {
        solicitudes: rows.map((s) => ({
          id: s.id_solicitud, idUsuario: s.id_usuario, rol: s.rol, estado: s.estado, fechaSolicitud: s.fecha_solicitud,
          fechaLimite: s.fecha_limite instanceof Date ? s.fecha_limite.toISOString().slice(0, 10) : s.fecha_limite, observacion: s.observacion,
        })),
      };
    },

    /** Últimas entradas de la bitácora de auditoría. */
    async bitacora({ query = {} }) {
      const limite = Math.min(200, Math.max(1, Number.parseInt(query.limite, 10) || 100));
      const { rows } = await pool.query(
        `SELECT b.fecha, b.accion, b.entidad, b.id_entidad, b.resultado, u.nombres || ' ' || u.apellidos AS usuario, u.rol
         FROM bitacora b LEFT JOIN usuario u ON u.id_usuario = b.id_usuario ORDER BY b.fecha DESC LIMIT $1`,
        [limite],
      );
      return { registros: rows.map((b) => ({ fecha: b.fecha, accion: b.accion, entidad: b.entidad, idEntidad: b.id_entidad, resultado: b.resultado, usuario: b.usuario, rol: b.rol })) };
    },
  };
}

module.exports = { createAdminService };
