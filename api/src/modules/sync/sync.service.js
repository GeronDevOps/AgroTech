'use strict';

const { errores, HttpError } = require('../../utils/http-error');
const { transaccion } = require('../../db/transaccion');
const { productoPublico } = require('../productos/productos.service');
const { pedidoPublico } = require('../pedidos/pedidos.service');
const { validarLote, validarPull } = require('./sync.validacion');

const LIMITE_PRODUCTOS = 500;
/** Solapamiento del pull: cubre transacciones que confirmaron después de la marca anterior. */
const SOLAPE_MS = 2 * 60 * 1000;

const errorPublico = (err) => ({ codigo: err.codigo, mensaje: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) });

/**
 * Manejadores de las operaciones que la cola del teléfono envía por /sync/push (CU-17 paso 3).
 * CU-02 (publicar con foto) no pasa por aquí: va a POST /productos, idempotente por el id del teléfono.
 * Fase 6 agrega MENSAJE.CREAR (CU-05) y CALIFICACION.CREAR (CU-06).
 */
function crearManejadores({ productosService }) {
  return {
    'PRODUCTO.EDITAR': {
      rol: 'PRODUCTOR',
      ejecutar: async ({ db, usuario, op, baseFotos }) => {
        if (!op.idEntidad || !op.datos) throw errores.datosInvalidos('PRODUCTO.EDITAR requiere idEntidad y datos.');
        const { producto } = await productosService.editar({ usuario, id: op.idEntidad, cambios: op.datos, baseFotos, db });
        return { producto };
      },
    },
  };
}

/**
 * Capa de negocio de CU-17 / RF-17: aplica la cola del teléfono y entrega los cambios desde la última sincronización.
 */
function createSyncService({ pool, syncRepository: repo, productosService, almacenFotos }) {
  const manejadores = crearManejadores({ productosService });

  /**
   * Aplica una operación en su propia transacción.
   * - Ya registrada (reenvío tras perder la respuesta) → YA_APLICADA o el mismo CON_ERROR.
   * - Error de negocio (4xx) → CON_ERROR registrado; no se aplica nada (SAVEPOINT).
   * - Error del servidor o de la BD → REINTENTAR (no se registra; la app la deja Pendiente).
   */
  async function aplicar({ usuario, op, baseFotos }) {
    try {
      return await transaccion(pool, async (db) => {
        await repo.bloquearOperacion(db, op.idOperacion);
        const previa = await repo.buscarOperacion(db, op.idOperacion);
        if (previa) {
          if (previa.id_usuario !== usuario.id) {
            return { idOperacion: op.idOperacion, resultado: 'CON_ERROR', error: { codigo: 'ID_EN_USO', mensaje: 'El identificador de la operación ya fue usado.' } };
          }
          return previa.resultado === 'PUBLICADO'
            ? { idOperacion: op.idOperacion, resultado: 'YA_APLICADA', ...previa.respuesta }
            : { idOperacion: op.idOperacion, resultado: 'CON_ERROR', error: previa.respuesta };
        }

        const registro = { idOperacion: op.idOperacion, idUsuario: usuario.id, tipo: op.tipo || '?', idEntidad: op.idEntidad, creadoEn: op.creadoEn };
        await db.query('SAVEPOINT operacion');
        try {
          const manejador = manejadores[op.tipo];
          if (!manejador) throw errores.datosInvalidos(`Operación no soportada: ${op.tipo || '(vacía)'}.`);
          if (manejador.rol && manejador.rol !== usuario.rol) throw errores.sinPermiso('Su rol no puede hacer esta operación.');
          const respuesta = await manejador.ejecutar({ db, usuario, op, baseFotos });
          await repo.registrarOperacion(db, { ...registro, resultado: 'PUBLICADO', respuesta });
          return { idOperacion: op.idOperacion, resultado: 'PUBLICADO', ...respuesta };
        } catch (err) {
          if (!(err instanceof HttpError) || err.status >= 500) throw err;
          await db.query('ROLLBACK TO SAVEPOINT operacion');
          const error = errorPublico(err);
          await repo.registrarOperacion(db, { ...registro, resultado: 'CON_ERROR', respuesta: error });
          return { idOperacion: op.idOperacion, resultado: 'CON_ERROR', error };
        }
      });
    } catch (err) {
      console.error(`[sync] operación ${op.idOperacion} no aplicada:`, err.message);
      return { idOperacion: op.idOperacion, resultado: 'REINTENTAR', error: { codigo: 'ERROR_TEMPORAL', mensaje: 'No se pudo aplicar ahora; se reintentará.' } };
    }
  }

  return {
    /** POST /sync/push: aplica el lote en el orden recibido (orden cronológico de la cola, CU-17 paso 3). */
    async push({ usuario, body, baseFotos }) {
      const ops = validarLote(body);
      const resultados = [];
      for (const op of ops) resultados.push(await aplicar({ usuario, op, baseFotos }));
      return { resultados };
    },

    /**
     * GET /sync/pull: productos y pedidos cambiados desde la última sincronización (CU-17 paso 4).
     * Productos paginados por cursor (actualizado_en, id) de a 500; pedidos solo en la primera página.
     * La app guarda `servidorEn` de la primera página como su nueva marca.
     */
    async pull({ usuario, query, baseFotos }) {
      const { desde, despuesDe } = validarPull(query);
      const servidorEn = await repo.ahora();
      const primeraPagina = !despuesDe;
      // Sin cursor se aplica el solapamiento; con cursor se continúa exactamente donde quedó la página anterior.
      const desdeEfectivo = desde && primeraPagina ? new Date(Date.parse(desde) - SOLAPE_MS).toISOString() : desde;

      const filas = await repo.productosCambiados({ idUsuario: usuario.id, desde: desdeEfectivo, despuesDe, limite: LIMITE_PRODUCTOS + 1 });
      const hayMas = filas.length > LIMITE_PRODUCTOS;
      const pagina = filas.slice(0, LIMITE_PRODUCTOS);
      const ultimo = pagina[pagina.length - 1];

      const respuesta = {
        servidorEn,
        completa: !desde, // sin `desde` la respuesta reemplaza la copia local
        productos: pagina.map((f) => productoPublico(f, almacenFotos, baseFotos)),
        hayMas,
        siguiente: hayMas ? { desde: ultimo.cursor_ts, despuesDe: ultimo.id_producto } : null,
      };
      if (primeraPagina) {
        respuesta.retirados = desde ? await repo.productosRetirados({ idUsuario: usuario.id, desde: desdeEfectivo }) : [];
        respuesta.pedidos = (await repo.pedidosCambiados({ idUsuario: usuario.id, desde: desdeEfectivo })).map(pedidoPublico);
      }
      return respuesta;
    },

    /** Tarea programada: borra los registros de operaciones con más de `dias` días. */
    depurar: ({ dias = 30 } = {}) => repo.depurar(dias),
  };
}

module.exports = { createSyncService, LIMITE_PRODUCTOS, SOLAPE_MS };
