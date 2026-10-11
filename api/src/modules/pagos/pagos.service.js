'use strict';

const crypto = require('node:crypto');
const { errores, HttpError } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { esUuid } = require('../productos/productos.validacion');
const { firmaIntegridad, urlCheckout, verificarEvento, ESTADOS } = require('./wompi');

const MINUTOS_PAGO_EN_CURSO = 30;
const ESTADO_PEDIDO = { APROBADA: 'APROBADO', RECHAZADA: 'RECHAZADO', ERROR: 'RECHAZADO', ANULADA: 'ANULADO' };

function pagoPublico(p) {
  return { id: p.id_pago, referencia: p.referencia, montoCentavos: Number(p.monto_centavos), moneda: p.moneda, estado: p.estado, medio: p.medio };
}

/**
 * Capa de negocio de CU-22 · RF-21 (ADR-001).
 * @param {{ pool, pagosRepository, wompi: object, eventos?: import('node:events').EventEmitter }} deps
 */
function createPagosService({ pool, pagosRepository: repo, wompi, eventos }) {
  const configurada = Boolean(wompi.llavePublica && wompi.secretoIntegridad && wompi.secretoEventos);
  const exigirConfiguracion = () => {
    if (!configurada) throw new HttpError(503, 'PASARELA_NO_CONFIGURADA', 'El pago en línea no está disponible en este momento. Puede pagar contra entrega.');
  };
  const checkout = (pago) => urlCheckout({
    urlBase: wompi.urlCheckout,
    llavePublica: wompi.llavePublica,
    referencia: pago.referencia,
    montoCentavos: Number(pago.monto_centavos),
    firma: firmaIntegridad({ referencia: pago.referencia, montoCentavos: Number(pago.monto_centavos), secretoIntegridad: wompi.secretoIntegridad }),
    urlRetorno: wompi.urlRetorno,
  });

  async function pedidoDelConsumidor(db, usuario, idPedido) {
    const p = esUuid(idPedido) ? await repo.bloquearPedido(db, idPedido) : null;
    if (!p || p.id_consumidor !== usuario.id) throw errores.noEncontrado('El pedido no existe.');
    return p;
  }

  return {
    /** Paso 2 de CU-22: registra el intento (o reutiliza el vigente) y devuelve la URL firmada. */
    async iniciar({ usuario, idPedido }) {
      exigirConfiguracion();
      const r = await transaccion(pool, async (db) => {
        const p = await pedidoDelConsumidor(db, usuario, idPedido);
        if (p.metodo_pago !== 'EN_LINEA') throw errores.conflicto('METODO_CONTRA_ENTREGA', 'Este pedido se paga contra entrega.');
        if (p.estado !== 'PENDIENTE') throw errores.conflicto('PEDIDO_NO_PENDIENTE', 'Solo se pagan pedidos pendientes.');
        const vigente = await repo.pagoVigente(db, p.id_pedido);
        if (vigente && vigente.estado === 'APROBADA') throw errores.conflicto('PAGO_YA_APROBADO', 'El pedido ya está pagado.');
        if (vigente) return { creado: false, pago: vigente };
        const pago = await repo.insertarPago(db, {
          idPedido: p.id_pedido,
          referencia: `AGRO-${crypto.randomUUID().replace(/-/g, '')}`,
          montoCentavos: Math.round(Number(p.total) * 100),   // el monto nunca viene del cliente
        });
        if (p.estado_pago !== 'PENDIENTE') await repo.actualizarPedidoPago(db, p.id_pedido, { estadoPago: 'PENDIENTE' });
        return { creado: true, pago };
      });
      return { creado: r.creado, pago: pagoPublico(r.pago), urlCheckout: checkout(r.pago) };
    },

    /** CU-22 A1: tras un rechazo (o un intento abandonado hace más de 30 min) el consumidor pasa a contra entrega. */
    async cambiarAContraEntrega({ usuario, idPedido, body = {} }) {
      if (String(body.metodoPago || '').toUpperCase() !== 'CONTRA_ENTREGA') {
        throw errores.datosInvalidos('Solo se puede cambiar a pago contra entrega.', { campos: { metodoPago: 'CONTRA_ENTREGA' } });
      }
      await transaccion(pool, async (db) => {
        const p = await pedidoDelConsumidor(db, usuario, idPedido);
        if (p.metodo_pago !== 'EN_LINEA') return;
        if (p.estado !== 'PENDIENTE') throw errores.conflicto('PEDIDO_NO_PENDIENTE', 'El pedido ya no está pendiente.');
        const vigente = await repo.pagoVigente(db, p.id_pedido);
        if (vigente && vigente.estado === 'APROBADA') throw errores.conflicto('PAGO_YA_APROBADO', 'El pedido ya está pagado.');
        if (vigente) {
          const minutos = (Date.now() - new Date(vigente.creado_en).getTime()) / 60000;
          if (minutos < MINUTOS_PAGO_EN_CURSO) {
            throw errores.conflicto('PAGO_EN_CURSO', `Hay un pago en curso. Si no lo terminó, podrá cambiar a contra entrega después de ${MINUTOS_PAGO_EN_CURSO} minutos.`);
          }
          await repo.actualizarPago(db, vigente.id_pago, { estado: 'ERROR', evento: vigente.evento });
        }
        await repo.actualizarPedidoPago(db, p.id_pedido, { metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA' });
      });
    },

    /**
     * Paso 4 de CU-22: evento «transaction.updated». Solo se acepta con checksum válido y del ambiente
     * configurado (A2); un evento repetido no se reprocesa (A3). El pedido se actualiza en la misma transacción.
     */
    async procesarEvento(evento) {
      exigirConfiguracion();
      if (!verificarEvento(evento, wompi.secretoEventos) || evento.environment !== wompi.ambiente) {
        throw new HttpError(401, 'FIRMA_INVALIDA', 'Evento sin firma válida.');
      }
      if (evento.event !== 'transaction.updated') return { resultado: 'IGNORADO' };
      const tx = evento.data.transaction || {};
      const estado = ESTADOS[tx.status] || 'ERROR';

      const r = await transaccion(pool, async (db) => {
        const pago = await repo.bloquearPagoPorReferencia(db, tx.reference);
        if (!pago) return { resultado: 'IGNORADO' };
        if (pago.id_transaccion === tx.id && pago.estado === estado) return { resultado: 'REPETIDO' };
        if (Number(tx.amount_in_cents) !== Number(pago.monto_centavos)) {
          await repo.actualizarPago(db, pago.id_pago, { estado: 'ERROR', idTransaccion: tx.id, medio: tx.payment_method_type, evento });
          await repo.bitacora(db, { accion: 'PAGO_MONTO_DISTINTO', idEntidad: pago.id_pago, resultado: 'RECHAZADO' });
          return { resultado: 'MONTO_DISTINTO' };
        }
        // PENDIENTE → cualquier final; APROBADA → ANULADA; ERROR (intento abandonado) → APROBADA si el pago llegó tarde.
        const permitida = pago.estado === 'PENDIENTE' || (pago.estado === 'APROBADA' && estado === 'ANULADA')
          || (pago.estado === 'ERROR' && estado === 'APROBADA');
        if (!permitida || estado === 'PENDIENTE') {
          if (estado === 'PENDIENTE') await repo.actualizarPago(db, pago.id_pago, { estado, idTransaccion: tx.id, medio: tx.payment_method_type, evento });
          return { resultado: 'SIN_CAMBIO' };
        }
        await repo.actualizarPago(db, pago.id_pago, { estado, idTransaccion: tx.id, medio: tx.payment_method_type, evento });
        const pedido = await repo.bloquearPedido(db, pago.id_pedido);
        if (estado === 'APROBADA') {
          // Dinero recibido: el pedido vuelve a "en línea" aunque se hubiera pasado a contra entrega.
          await repo.actualizarPedidoPago(db, pedido.id_pedido, { metodoPago: 'EN_LINEA', estadoPago: 'APROBADO' });
          if (pedido.estado === 'CANCELADO') {
            await repo.bitacora(db, { accion: 'PAGO_SOBRE_PEDIDO_CANCELADO', idEntidad: pago.id_pago, resultado: 'REVISAR' });
          }
        } else if (pedido.metodo_pago === 'EN_LINEA') {
          await repo.actualizarPedidoPago(db, pedido.id_pedido, { estadoPago: ESTADO_PEDIDO[estado] });
        }
        await repo.bitacora(db, { accion: `PAGO_${estado}`, idEntidad: pago.id_pago, resultado: 'EXITOSO' });
        return { resultado: 'ACTUALIZADO', idPedido: pedido.id_pedido, idProductor: pedido.id_productor, estado };
      });
      if (r.resultado === 'ACTUALIZADO' && eventos) eventos.emit('pago_actualizado', r);
      return { resultado: r.resultado };
    },
  };
}

module.exports = { createPagosService };
