'use strict';

const { errores } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { esUuid } = require('../productos/productos.validacion');
const {
  validarClave, validarConfirmacion, validarCambioEstado, validarCancelacion, validarFiltrosPedidos,
} = require('./pedidos.validacion');
const { registrarBitacora } = require('../../utils/bitacora');

const TAMANO_PAGINA = 30;
const ACTIVOS = ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO'];

/** CU-15 paso 3: acciones disponibles para quien consulta el pedido. */
function accionesPara(f, usuario) {
  const esConsumidor = f.id_consumidor === usuario.id;
  const acciones = [];
  if (ACTIVOS.includes(f.estado)) acciones.push('CHAT', 'CANCELAR');
  if (!esConsumidor && f.estado === 'PENDIENTE') acciones.push('ACEPTAR', 'RECHAZAR');
  if (!esConsumidor && f.estado === 'ACEPTADO') acciones.push('DESPACHAR');
  if (!esConsumidor && f.estado === 'EN_CAMINO') acciones.push('ENTREGAR');
  if (esConsumidor && f.estado === 'ENTREGADO' && !f.cal_puntuacion) acciones.push('CALIFICAR');
  acciones.push('REPORTAR'); // CU-14 A1 / CU-19: incumplimientos, también de pedidos entregados
  return acciones;
}

const nombreCorto = (n, a) => `${n} ${a.charAt(0)}.`;
const redondear = (x) => Math.round(x * 100) / 100;

function pedidoPublico(f) {
  return {
    id: f.id_pedido,
    clave: f.clave_idempotencia,
    estado: f.estado,
    metodoPago: f.metodo_pago,
    estadoPago: f.estado_pago,
    total: Number(f.total),
    puntoEntrega: f.punto_entrega,
    franjaEntrega: f.franja_entrega,
    motivoCancelacion: f.motivo_cancelacion,
    fecha: f.fecha,
    actualizadoEn: f.actualizado_en,
    version: f.version,
    consumidor: { id: f.id_consumidor, nombre: nombreCorto(f.c_nombres, f.c_apellidos) },
    productor: { id: f.id_productor, nombre: nombreCorto(f.p_nombres, f.p_apellidos), municipio: f.p_municipio },
    items: (f.items || []).map((i) => ({ ...i, cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario), subtotal: Number(i.subtotal) })),
    // CU-06: calificación del pedido (solo lectura una vez hecha, A2).
    calificacion: f.cal_puntuacion ? { puntuacion: f.cal_puntuacion, comentario: f.cal_comentario, fecha: f.cal_fecha } : null,
  };
}

/**
 * Capa de negocio de CU-04 (confirmar pedido), CU-13 (estados), CU-15 (consultar pedidos).
 * @param {{ pool, pedidosRepository, eventos: import('node:events').EventEmitter }} deps
 */
function createPedidosService({ pool, pedidosRepository: repo, eventos }) {
  const emitir = (evento, datos) => { if (eventos) eventos.emit(evento, datos); };

  return {
    /**
     * CU-04. Una sola transacción: bloquea los productos en orden fijo, valida el stock, crea un
     * pedido por productor con su detalle e historial y descuenta el inventario (RNF-10).
     * Reintento con la misma Idempotency-Key → mismo comprobante, sin efectos nuevos.
     */
    async confirmar({ usuario, clave: claveBruta, body }) {
      const clave = validarClave(claveBruta);
      const d = validarConfirmacion(body);

      const r = await transaccion(pool, async (db) => {
        await repo.bloquearClave(db, clave);
        const previos = await repo.pedidosPorClave(db, clave);
        if (previos.length) {
          if (previos.some((p) => p.id_consumidor !== usuario.id)) {
            throw errores.conflicto('CLAVE_EN_USO', 'La clave de idempotencia ya fue usada por otro usuario.');
          }
          return { creado: false, filas: previos };
        }

        const productos = await repo.bloquearProductos(db, d.items.map((i) => i.idProducto));
        const porId = new Map(productos.map((p) => [p.id_producto, p]));
        const faltantes = [];
        for (const it of d.items) {
          const p = porId.get(it.idProducto);
          if (!p || p.estado !== 'ACTIVA' || p.estado_productor !== 'ACTIVA' || p.id_productor === usuario.id) {
            faltantes.push({ idProducto: it.idProducto, nombre: p ? p.nombre : null, disponible: 0, solicitado: it.cantidad });
          } else if (Number(p.stock) < it.cantidad) {
            faltantes.push({ idProducto: it.idProducto, nombre: p.nombre, disponible: Number(p.stock), solicitado: it.cantidad });
          }
        }
        if (faltantes.length) {
          // CU-04 A1: se revierte todo el carrito e indica qué ajustar.
          throw errores.conflicto('STOCK_INSUFICIENTE', 'No hay suficiente cantidad de algunos productos. Ajuste el carrito.', { productos: faltantes });
        }

        // CU-04 A3: un pedido por productor.
        const grupos = new Map();
        for (const it of d.items) {
          const p = porId.get(it.idProducto);
          if (!grupos.has(p.id_productor)) grupos.set(p.id_productor, []);
          grupos.get(p.id_productor).push({ ...it, precio: Number(p.precio) });
        }
        for (const [idProductor, lineas] of grupos) {
          const total = redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0));
          const idPedido = await repo.insertarPedido(db, {
            idConsumidor: usuario.id, idProductor, clave, total,
            puntoEntrega: d.puntoEntrega, franjaEntrega: d.franjaEntrega, metodoPago: d.metodoPago,
          });
          for (const l of lineas) {
            await repo.insertarDetalle(db, idPedido, l);
            await repo.moverStock(db, l.idProducto, l.cantidad);
          }
          await repo.registrarHistorial(db, { idPedido, idUsuario: usuario.id, nuevo: 'PENDIENTE' });
        }
        return { creado: true, filas: await repo.pedidosPorClave(db, clave) };
      });

      const pedidos = r.filas.map(pedidoPublico);
      if (r.creado) pedidos.forEach((p) => emitir('nuevo_pedido', { idPedido: p.id, idProductor: p.productor.id }));
      return { creado: r.creado, clave, pedidos };
    },

    /**
     * CU-15 (consumidor) y "Pedidos recibidos" del productor (CU-13), del más reciente al más antiguo.
     * RF-15: filtros por estado (activos, finalizados, todos o estados puntuales) y por fechas; paginado de a 30.
     */
    async listar({ usuario, query = {} }) {
      const f = validarFiltrosPedidos(query);
      const filas = await repo.delUsuario({
        idUsuario: usuario.id, rol: usuario.rol, estados: f.estados, desde: f.desde, hasta: f.hasta,
        limite: TAMANO_PAGINA, desplazamiento: (f.pagina - 1) * TAMANO_PAGINA,
      });
      const total = filas.length ? Number(filas[0].total_filas) : 0;
      const sinLeer = await repo.sinLeer(filas.map((x) => x.id_pedido), usuario.id);
      return {
        pedidos: filas.map((x) => ({ ...pedidoPublico(x), mensajesSinLeer: sinLeer[x.id_pedido] || 0 })),
        pagina: f.pagina,
        total,
        hayMas: f.pagina * TAMANO_PAGINA < total,
      };
    },

    /** Detalle para las partes del pedido: productos, historial de estados y último pago. */
    async detalle({ usuario, id }) {
      const f = esUuid(id) ? await repo.buscarPorId(null, id) : null;
      if (!f || (f.id_consumidor !== usuario.id && f.id_productor !== usuario.id)) throw errores.noEncontrado('El pedido no existe.');
      const historial = (await repo.historial(id)).map((h) => ({ estadoAnterior: h.estado_anterior, estadoNuevo: h.estado_nuevo, fecha: h.fecha }));
      const pago = await repo.ultimoPago(id);
      const sinLeer = await repo.sinLeer([id], usuario.id);
      return {
        pedido: {
          ...pedidoPublico(f),
          mensajesSinLeer: sinLeer[id] || 0,
          acciones: accionesPara(f, usuario),
          historial,
          pago: pago ? { estado: pago.estado, medio: pago.medio, referencia: pago.referencia, fecha: pago.creado_en } : null,
        },
      };
    },

    /**
     * CU-13. Solo el productor del pedido. La base de datos rechaza saltos de estado (409 TRANSICION_NO_PERMITIDA).
     * Rechazo (Pendiente → Cancelado) exige motivo y restituye el inventario (A1).
     */
    async cambiarEstado({ usuario, id, body }) {
      const c = validarCambioEstado(body);
      if (!esUuid(id)) throw errores.noEncontrado('El pedido no existe.');
      await transaccion(pool, async (db) => {
        const p = await repo.bloquearPedido(db, id);
        if (!p || p.id_productor !== usuario.id) throw errores.noEncontrado('El pedido no existe.');
        if (c.version !== undefined && c.version !== p.version) {
          throw errores.conflicto('CONFLICTO_VERSION', 'El pedido cambió. Actualice y vuelva a intentar.');
        }
        if (c.estado === 'ACEPTADO' && p.metodo_pago === 'EN_LINEA' && p.estado_pago !== 'APROBADO') {
          throw errores.conflicto('PAGO_NO_APROBADO', 'El consumidor eligió pagar en línea y el pago todavía no está aprobado.');
        }
        if (c.estado === 'CANCELADO' && p.estado !== 'PENDIENTE') {
          throw errores.conflicto('TRANSICION_NO_PERMITIDA', 'El rechazo es solo para pedidos pendientes. Para un pedido ya aceptado use «Cancelar pedido» (POST /pedidos/{id}/cancelar).');
        }
        await repo.actualizarEstado(db, id, { estado: c.estado, motivo: c.estado === 'CANCELADO' ? c.motivo : null });
        if (c.estado === 'CANCELADO') {
          for (const linea of await repo.detalleDe(db, id)) await repo.moverStock(db, linea.id_producto, -Number(linea.cantidad));
        }
        await repo.registrarHistorial(db, { idPedido: id, idUsuario: usuario.id, anterior: p.estado, nuevo: c.estado });
      });
      emitir('estado_pedido', { idPedido: id, estado: c.estado, porUsuario: usuario.id });
      return this.detalle({ usuario, id });
    },

    /**
     * CU-14 · Cancelar un pedido no entregado (RF-14), por el consumidor o el productor.
     * Una sola transacción: estado CANCELADO, inventario restituido, historial con usuario, motivo y hora (paso 3).
     * A1 pedido entregado → 409 PEDIDO_ENTREGADO (se usa un reporte, CU-19).
     * A2 cancelaciones simultáneas → el pedido queda bloqueado (FOR UPDATE): prevalece la primera, la otra recibe 409 YA_CANCELADO.
     * A3 falla al restituir → se revierte todo y el incidente queda en la bitácora.
     * Paso 4: se avisa a la contraparte (tiempo real y push); el chat queda en solo lectura (disparador fn_validar_mensaje).
     */
    async cancelar({ usuario, id, body }) {
      const c = validarCancelacion(body);
      if (!esUuid(id)) throw errores.noEncontrado('El pedido no existe.');
      let r;
      try {
        r = await transaccion(pool, async (db) => {
          const p = await repo.bloquearPedido(db, id);
          if (!p || (p.id_consumidor !== usuario.id && p.id_productor !== usuario.id)) throw errores.noEncontrado('El pedido no existe.');
          if (p.estado === 'CANCELADO') throw errores.conflicto('YA_CANCELADO', 'El pedido ya estaba cancelado.', { motivo: p.motivo_cancelacion });
          if (p.estado === 'ENTREGADO') {
            throw errores.conflicto('PEDIDO_ENTREGADO', 'El pedido ya fue entregado y no se puede cancelar. Si hubo un problema, use «Reportar».');
          }
          if (c.version !== undefined && c.version !== p.version) {
            throw errores.conflicto('CONFLICTO_VERSION', 'El pedido cambió. Actualice y vuelva a intentar.');
          }
          const quien = p.id_consumidor === usuario.id ? 'Consumidor' : 'Productor';
          await repo.actualizarEstado(db, id, { estado: 'CANCELADO', motivo: `${quien}: ${c.motivo}`.slice(0, 150) });
          for (const linea of await repo.detalleDe(db, id)) await repo.moverStock(db, linea.id_producto, -Number(linea.cantidad));
          await repo.anularPagoPendiente(db, id);
          await repo.registrarHistorial(db, { idPedido: id, idUsuario: usuario.id, anterior: p.estado, nuevo: 'CANCELADO' });
          const reembolso = p.metodo_pago === 'EN_LINEA' && p.estado_pago === 'APROBADO';
          await registrarBitacora(db, { idUsuario: usuario.id, accion: 'PEDIDO_CANCELADO', entidad: 'PEDIDO', idEntidad: id, resultado: reembolso ? 'REEMBOLSO_PEND' : 'EXITOSO' });
          return { anterior: p.estado, reembolso };
        });
      } catch (err) {
        if (!err.status || err.status >= 500) {
          // A3: la transacción se revirtió (inventario intacto); el incidente queda registrado.
          await registrarBitacora(pool, { idUsuario: usuario.id, accion: 'PEDIDO_CANCELADO', entidad: 'PEDIDO', idEntidad: id, resultado: 'FALLIDO' }).catch(() => {});
        }
        throw err;
      }
      emitir('estado_pedido', { idPedido: id, estado: 'CANCELADO', porUsuario: usuario.id });
      const detalle = await this.detalle({ usuario, id });
      return { ...detalle, reembolsoPendiente: r.reembolso };
    },

    /** CU-13 A3: tarea programada que cancela los pedidos pendientes sin respuesta y restituye el inventario. */
    async cancelarVencidos({ horas = 48 } = {}) {
      const cancelados = await transaccion(pool, async (db) => {
        const ids = await repo.pendientesVencidos(db, horas);
        for (const id of ids) {
          await repo.actualizarEstado(db, id, { estado: 'CANCELADO', motivo: `Sin respuesta del productor en ${horas} horas` });
          for (const linea of await repo.detalleDe(db, id)) await repo.moverStock(db, linea.id_producto, -Number(linea.cantidad));
          await repo.registrarHistorial(db, { idPedido: id, idUsuario: null, anterior: 'PENDIENTE', nuevo: 'CANCELADO' });
        }
        return ids;
      });
      cancelados.forEach((id) => emitir('estado_pedido', { idPedido: id, estado: 'CANCELADO' }));
      return cancelados;
    },
  };
}


module.exports = { createPedidosService, pedidoPublico, accionesPara };
