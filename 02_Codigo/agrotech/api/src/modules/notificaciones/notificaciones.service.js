'use strict';

const { ErrorTemporalFcm } = require('./fcm');

const MAX_INTENTOS = 5;
const formatoPesos = (n) => `$ ${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const nombreCorto = (n, a) => `${n} ${a.charAt(0)}.`;

const ESTADOS_TEXTO = Object.freeze({
  ACEPTADO: { titulo: '✅ Pedido aceptado', cuerpo: (f) => `${f.p_nombre} aceptó su pedido de ${f.productos}. Le avisaremos cuando salga.` },
  EN_CAMINO: { titulo: '🚚 Pedido en camino', cuerpo: (f) => `Su pedido de ${f.productos} va en camino a ${f.punto_entrega}.` },
  ENTREGADO: { titulo: '📦 Pedido entregado', cuerpo: (f) => `Se entregó su pedido de ${f.productos}. Califique a ${f.p_nombre}.` },
});

const publicaNotificacion = (n) => ({
  id: n.id_notificacion, tipo: n.tipo, titulo: n.titulo, cuerpo: n.cuerpo, datos: n.datos, fecha: n.creado_en, leida: !!n.leida_en,
});

/**
 * Avisos al usuario (RF-16 · CU-16): pedido nuevo y pagado (MVP), cambios de estado, cancelaciones,
 * mensajes del chat y resultados de moderación (Fase 2).
 * Todo aviso queda primero en la tabla notificacion, que es a la vez la bandeja interna de la app (CU-16 A1/A3)
 * y la bandeja de salida del push: una falla de FCM no afecta la operación y se reintenta (CU-04 A4)
 * con espera creciente (1, 2, 4, 8 min) hasta 5 intentos. Sin dispositivos el aviso queda SIN_DISPOSITIVO;
 * sin FCM_CREDENCIALES (push desactivado) queda SOLO_BANDEJA. En ambos casos se ve en la bandeja y llega por WebSocket.
 */
function createNotificacionesService({ pool, fcm, eventos }) {
  /**
   * Registra el aviso. El aviso sale después de responder la operación (en segundo plano), así que puede
   * cruzarse con otros cambios: un interbloqueo (40P01) se reintenta y, si el destinatario ya no existe
   * (23503), el aviso se descarta sin error.
   */
  async function encolar({ idUsuario, tipo, titulo, cuerpo, datos }, intento = 1) {
    let rows;
    try {
      ({ rows } = await pool.query(
        `INSERT INTO notificacion (id_usuario, tipo, titulo, cuerpo, datos, estado_envio)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [idUsuario, tipo, titulo.slice(0, 80), cuerpo.slice(0, 200), datos, fcm ? 'PENDIENTE' : 'SOLO_BANDEJA'],
      ));
    } catch (err) {
      if (err.code === '23503') return null;
      if (err.code === '40P01' && intento < 3) return encolar({ idUsuario, tipo, titulo, cuerpo, datos }, intento + 1);
      throw err;
    }
    if (eventos) eventos.emit('notificacion_nueva', { idUsuario, notificacion: publicaNotificacion(rows[0]) });
    return rows[0].id_notificacion;
  }

  /** Intenta entregar una notificación a todos los teléfonos vigentes del usuario. */
  async function entregar(n) {
    const { rows: dispositivos } = await pool.query("SELECT token FROM dispositivo WHERE id_usuario = $1 AND estado = 'VIGENTE'", [n.id_usuario]);
    let enviadas = 0;
    let temporal = null;
    for (const { token } of dispositivos) {
      try {
        const r = await fcm.enviar({ token, titulo: n.titulo, cuerpo: n.cuerpo, datos: { ...n.datos, tipo: n.tipo } });
        if (r === 'ENVIADA') enviadas += 1;
        else await pool.query("UPDATE dispositivo SET estado = 'INVALIDO' WHERE token = $1", [token]);
      } catch (err) {
        if (!(err instanceof ErrorTemporalFcm)) throw err;
        temporal = err.message;
      }
    }
    if (enviadas) {
      await pool.query("UPDATE notificacion SET estado_envio = 'ENVIADA', enviado_en = now(), intentos = intentos + 1, ultimo_error = NULL WHERE id_notificacion = $1", [n.id_notificacion]);
      return 'ENVIADA';
    }
    if (!temporal) {
      await pool.query("UPDATE notificacion SET estado_envio = 'SIN_DISPOSITIVO', intentos = intentos + 1 WHERE id_notificacion = $1", [n.id_notificacion]);
      return 'SIN_DISPOSITIVO';
    }
    const intentos = n.intentos + 1;
    const estado = intentos >= MAX_INTENTOS ? 'FALLIDA' : 'PENDIENTE';
    await pool.query(
      `UPDATE notificacion SET intentos = $2, estado_envio = $3, ultimo_error = $4,
              proximo_intento = now() + make_interval(mins => $5) WHERE id_notificacion = $1`,
      [n.id_notificacion, intentos, estado, temporal.slice(0, 200), 2 ** (intentos - 1)],
    );
    return estado;
  }

  /** Envía las notificaciones pendientes cuyo turno llegó (tarea de cada minuto y envío inmediato). */
  async function procesarPendientes({ id } = {}) {
    if (!fcm) return [];
    const client = await pool.connect();
    let filas;
    try {
      await client.query('BEGIN');
      ({ rows: filas } = await client.query(
        `SELECT * FROM notificacion WHERE estado_envio = 'PENDIENTE' AND proximo_intento <= now() ${id ? 'AND id_notificacion = $1' : ''}
         ORDER BY proximo_intento LIMIT 50 FOR UPDATE SKIP LOCKED`,
        id ? [id] : [],
      ));
      // Se aparta el turno para que otra instancia no la envíe dos veces mientras sale.
      if (filas.length) await client.query("UPDATE notificacion SET proximo_intento = now() + interval '5 minutes' WHERE id_notificacion = ANY($1::uuid[])", [filas.map((f) => f.id_notificacion)]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const resultados = [];
    for (const n of filas) resultados.push(await entregar(n));
    return resultados;
  }

  async function avisar(datos) {
    const id = await encolar(datos);
    if (id && fcm) await procesarPendientes({ id });
  }

  /** Datos del pedido para redactar los avisos. */
  async function datosPedido(idPedido) {
    const { rows } = await pool.query(
      `SELECT p.id_pedido, p.id_consumidor, p.id_productor, p.total, p.punto_entrega, p.motivo_cancelacion,
              uc.nombres || ' ' || left(uc.apellidos, 1) || '.' AS c_nombre,
              up.nombres || ' ' || left(up.apellidos, 1) || '.' AS p_nombre,
              (SELECT string_agg(pr.nombre, ', ' ORDER BY pr.nombre) FROM detalle_pedido d JOIN producto pr ON pr.id_producto = d.id_producto WHERE d.id_pedido = p.id_pedido) AS productos
       FROM pedido p JOIN usuario uc ON uc.id_usuario = p.id_consumidor JOIN usuario up ON up.id_usuario = p.id_productor
       WHERE p.id_pedido = $1`,
      [idPedido],
    );
    return rows[0] || null;
  }

  /** CU-16 paso 2: cambio de estado (al consumidor) y cancelación (a la contraparte de quien canceló). */
  async function alEstadoPedido({ idPedido, estado, porUsuario }) {
    const f = await datosPedido(idPedido);
    if (!f) return;
    if (estado === 'CANCELADO') {
      const destinos = porUsuario ? [porUsuario === f.id_consumidor ? f.id_productor : f.id_consumidor] : [f.id_consumidor, f.id_productor];
      for (const idUsuario of destinos) {
        await avisar({
          idUsuario,
          tipo: 'PEDIDO_CANCELADO',
          titulo: '❌ Pedido cancelado',
          cuerpo: `Se canceló el pedido de ${f.productos}. ${f.motivo_cancelacion || ''}`.trim(),
          datos: { idPedido },
        });
      }
      return;
    }
    const t = ESTADOS_TEXTO[estado];
    if (!t) return;
    await avisar({ idUsuario: f.id_consumidor, tipo: `PEDIDO_${estado}`, titulo: t.titulo, cuerpo: t.cuerpo(f), datos: { idPedido } });
  }

  /** CU-16 paso 2: mensaje nuevo del chat al otro participante; al tocarlo se abre el chat (paso 3). */
  async function alMensajeNuevo({ mensaje, partes }) {
    const receptor = partes.find((id) => id !== mensaje.idEmisor);
    if (!receptor) return;
    const { rows: [u] } = await pool.query("SELECT nombres || ' ' || left(apellidos, 1) || '.' AS nombre FROM usuario WHERE id_usuario = $1", [mensaje.idEmisor]);
    await avisar({
      idUsuario: receptor,
      tipo: 'MENSAJE',
      titulo: `💬 ${u ? u.nombre : 'Mensaje nuevo'}`,
      cuerpo: mensaje.contenido.length > 120 ? `${mensaje.contenido.slice(0, 117)}…` : mensaje.contenido,
      datos: { idPedido: mensaje.idPedido, abrir: 'CHAT' },
    });
  }

  /** Avisos de moderación y de reportes (CU-18 paso 3, CU-19 paso 4). */
  const alAvisoUsuario = (d) => avisar(d);

  async function alPedidoNuevo({ idPedido }) {
    const { rows } = await pool.query(
      `SELECT p.id_productor, p.total, u.nombres, u.apellidos,
              (SELECT string_agg(pr.nombre, ', ' ORDER BY pr.nombre) FROM detalle_pedido d JOIN producto pr ON pr.id_producto = d.id_producto WHERE d.id_pedido = p.id_pedido) AS productos
       FROM pedido p JOIN usuario u ON u.id_usuario = p.id_consumidor WHERE p.id_pedido = $1`,
      [idPedido],
    );
    if (!rows[0]) return;
    const f = rows[0];
    await avisar({
      idUsuario: f.id_productor,
      tipo: 'PEDIDO_NUEVO',
      titulo: '🧺 Nuevo pedido',
      cuerpo: `${nombreCorto(f.nombres, f.apellidos)} pidió ${f.productos} · ${formatoPesos(f.total)}. Ábralo para aceptarlo.`,
      datos: { idPedido },
    });
  }

  async function alPagoActualizado({ idPedido, idProductor, estado }) {
    if (estado !== 'APROBADA') return;
    await avisar({ idUsuario: idProductor, tipo: 'PEDIDO_PAGADO', titulo: '💳 Pedido pagado', cuerpo: 'El pago en línea fue aprobado. Ya puede aceptar el pedido.', datos: { idPedido } });
  }

  const oyentes = [
    ['nuevo_pedido', alPedidoNuevo],
    ['pago_actualizado', alPagoActualizado],
    ['estado_pedido', alEstadoPedido],
    ['mensaje_nuevo', alMensajeNuevo],
    ['aviso_usuario', alAvisoUsuario],
  ].map(([evento, fn]) => [evento, (d) => fn(d).catch((err) => console.error(`[push] ${evento}:`, err.message))]);

  return {
    escuchar() { oyentes.forEach(([e, f]) => eventos.on(e, f)); },
    dejarDeEscuchar() { oyentes.forEach(([e, f]) => eventos.off(e, f)); },
    procesarPendientes,
    avisar,

    /** Bandeja interna (CU-16 A1/A3): avisos del usuario del más reciente al más antiguo, de a 30. */
    async bandeja({ usuario, query = {} }) {
      const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1);
      const { rows } = await pool.query(
        'SELECT * FROM notificacion WHERE id_usuario = $1 ORDER BY creado_en DESC, id_notificacion LIMIT 31 OFFSET $2',
        [usuario.id, (pagina - 1) * 30],
      );
      const { rows: [c] } = await pool.query('SELECT count(*)::int AS n FROM notificacion WHERE id_usuario = $1 AND leida_en IS NULL', [usuario.id]);
      return { notificaciones: rows.slice(0, 30).map(publicaNotificacion), sinLeer: c.n, pagina, hayMas: rows.length > 30 };
    },

    /** Marca leídas las indicadas o, sin lista, todas. */
    async marcarLeidas({ usuario, body = {} }) {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : null;
      const { rowCount } = await pool.query(
        `UPDATE notificacion SET leida_en = now() WHERE id_usuario = $1 AND leida_en IS NULL ${ids ? 'AND id_notificacion = ANY($2::uuid[])' : ''}`,
        ids ? [usuario.id, ids] : [usuario.id],
      );
      return { marcadas: rowCount };
    },
  };
}

module.exports = { createNotificacionesService, MAX_INTENTOS, publicaNotificacion };
