'use strict';

const { errores } = require('../../utils/http-error');
const { esUuid } = require('../productos/productos.validacion');
const { validarMensaje } = require('./mensajes.validacion');

const CERRADOS = ['ENTREGADO', 'CANCELADO'];
const nombreCorto = (n, a) => `${n} ${a.charAt(0)}.`;

const mensajePublico = (f) => ({
  id: f.id_mensaje, idPedido: f.id_pedido, idEmisor: f.id_emisor, contenido: f.contenido,
  fecha: f.fecha, leido: f.leido, leidoEn: f.leido_en,
});

/**
 * CU-05 · Chat por pedido (RF-05). Solo las partes del pedido; sin datos personales (RNF-05):
 * el chat reemplaza el intercambio de teléfonos. Los eventos los entrega el servidor WebSocket.
 */
function createMensajesService({ pool, mensajesRepository: repo, eventos }) {
  const emitir = (evento, datos) => { if (eventos) eventos.emit(evento, datos); };

  async function pedidoDeParte(db, usuario, idPedido) {
    const p = esUuid(idPedido) ? await repo.pedido(db, idPedido) : null;
    if (!p || (p.id_consumidor !== usuario.id && p.id_productor !== usuario.id)) throw errores.noEncontrado('El pedido no existe.');
    return p;
  }

  return {
    /**
     * Envía un mensaje. Idempotente por el id del teléfono (reenvío de la cola, CU-05 A1).
     * `diferir`: dentro de /sync/push el aviso sale después de confirmar la transacción.
     */
    async enviar({ usuario, idPedido, body, db = pool, diferir = false }) {
      const d = validarMensaje(body);
      const p = await pedidoDeParte(db, usuario, idPedido);
      const previo = await repo.buscar(db, d.id);
      if (previo) {
        if (previo.id_emisor !== usuario.id || previo.id_pedido !== p.id_pedido) throw errores.conflicto('ID_EN_USO', 'El identificador del mensaje ya fue usado.');
        return { creado: false, mensaje: mensajePublico(previo) };
      }
      if (CERRADOS.includes(p.estado)) throw errores.conflicto('CHAT_CERRADO', 'El pedido ya terminó: el chat quedó en solo lectura.');
      const fila = (await repo.insertar(db, { id: d.id, idPedido: p.id_pedido, idEmisor: usuario.id, contenido: d.contenido }))
        || await repo.buscar(db, d.id); // carrera entre dos reenvíos
      const mensaje = mensajePublico(fila);
      const avisar = () => emitir('mensaje_nuevo', { mensaje, partes: [p.id_consumidor, p.id_productor] });
      if (diferir) return { creado: true, mensaje, alConfirmar: avisar };
      avisar();
      return { creado: true, mensaje };
    },

    /** CU-05 paso 1: historial del chat y si admite mensajes nuevos. */
    async listar({ usuario, idPedido, query = {} }) {
      const p = await pedidoDeParte(pool, usuario, idPedido);
      if (query.despuesDe !== undefined && Number.isNaN(Date.parse(query.despuesDe))) throw errores.datosInvalidos('"despuesDe" debe ser una fecha ISO 8601.');
      const filas = await repo.delPedido(p.id_pedido, { despuesDe: query.despuesDe, limite: 200 });
      return { abierto: !CERRADOS.includes(p.estado), estadoPedido: p.estado, mensajes: filas.map(mensajePublico) };
    },

    /** CU-05 paso 4: al abrir la conversación se marcan leídos los mensajes recibidos y se avisa al emisor. */
    async marcarLeidos({ usuario, idPedido }) {
      const p = await pedidoDeParte(pool, usuario, idPedido);
      const filas = await repo.marcarLeidos(p.id_pedido, usuario.id);
      if (filas.length) {
        emitir('mensajes_leidos', { idPedido: p.id_pedido, idLector: usuario.id, ids: filas.map((f) => f.id_mensaje), partes: [p.id_consumidor, p.id_productor] });
      }
      return { leidos: filas.length };
    },

    /** Bandeja "Mensajes": una fila por pedido con su último mensaje y los no leídos. */
    async conversaciones({ usuario }) {
      const filas = await repo.conversaciones(usuario.id);
      return {
        conversaciones: filas.map((f) => {
          const soyConsumidor = f.id_consumidor === usuario.id;
          return {
            idPedido: f.id_pedido,
            estadoPedido: f.estado,
            abierto: !CERRADOS.includes(f.estado),
            total: Number(f.total),
            contraparte: soyConsumidor ? nombreCorto(f.p_nombres, f.p_apellidos) : nombreCorto(f.c_nombres, f.c_apellidos),
            ultimoMensaje: f.ult_fecha ? { contenido: f.ult_contenido, fecha: f.ult_fecha, propio: f.ult_emisor === usuario.id } : null,
            sinLeer: f.sin_leer,
          };
        }),
      };
    },
  };
}

module.exports = { createMensajesService, mensajePublico };
