'use strict';

const { EventEmitter } = require('node:events');

/**
 * Bus de eventos del proceso (Entrega 3, arquitectura: "eventos internos con EventEmitter").
 * Eventos emitidos desde la fase 4: nuevo_pedido, estado_pedido, pago_actualizado.
 * La fase 6 los suscribe para el WebSocket y las notificaciones push (RF-16a).
 */
function createBusEventos() {
  const bus = new EventEmitter();
  bus.setMaxListeners(20);
  return bus;
}

module.exports = { createBusEventos };
