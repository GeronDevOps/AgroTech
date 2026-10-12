'use strict';

const { ErrorTemporalFcm } = require('./fcm');

const MAX_INTENTOS = 5;
const formatoPesos = (n) => `$ ${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const nombreCorto = (n, a) => `${n} ${a.charAt(0)}.`;

/**
 * Avisos push (RF-16a · MVP: "nuevo pedido" al productor; también "pedido pagado", RF-21).
 * Bandeja de salida en la tabla notificacion: el aviso se registra primero y se envía después,
 * así una falla de FCM no afecta el pedido y se reintenta (CU-04 A4) con espera creciente
 * (1, 2, 4, 8 min) hasta 5 intentos. Sin dispositivos registrados el aviso queda SIN_DISPOSITIVO
 * (CU-16 A1: el productor lo ve dentro de la app por WebSocket y en "Mis pedidos").
 * Sin FCM_CREDENCIALES el push está desactivado y no se registra nada (el aviso llega solo por WebSocket).
 */
function createNotificacionesService({ pool, fcm, eventos }) {
  async function encolar({ idUsuario, tipo, titulo, cuerpo, datos }) {
    const { rows } = await pool.query(
      `INSERT INTO notificacion (id_usuario, tipo, titulo, cuerpo, datos, estado_envio)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_notificacion`,
      [idUsuario, tipo, titulo.slice(0, 80), cuerpo.slice(0, 200), datos, 'PENDIENTE'],
    );
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
    if (!fcm) return; // push desactivado (sin FCM_CREDENCIALES): el aviso llega solo por WebSocket
    const id = await encolar(datos);
    await procesarPendientes({ id });
  }

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
  ].map(([evento, fn]) => [evento, (d) => fn(d).catch((err) => console.error(`[push] ${evento}:`, err.message))]);

  return {
    escuchar() { oyentes.forEach(([e, f]) => eventos.on(e, f)); },
    dejarDeEscuchar() { oyentes.forEach(([e, f]) => eventos.off(e, f)); },
    procesarPendientes,
  };
}

module.exports = { createNotificacionesService, MAX_INTENTOS };
