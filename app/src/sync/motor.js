import { api } from '../api/cliente';
import { aplicarPull, guardarCalificacionLocal, guardarMensajes, guardarProductos } from '../local/cache';
import { guardarMeta, leerMeta } from '../local/baseLocal';
import { borrarFotosCola } from '../local/archivosCola';
import {
  devolverAPendiente, marcarConError, marcarEnviando, pendientesEnOrden, quitarPublicada,
} from '../local/cola';

/**
 * Motor de sincronización (CU-17 pasos 3 y 4; protocolo de la Entrega 3).
 * 1) Envía la cola en orden cronológico: las publicaciones con foto van a POST /productos (idempotente por id)
 *    y las demás (ediciones, mensajes del chat, calificaciones), en lotes consecutivos, a POST /sync/push.
 * 2) Descarga los cambios con GET /sync/pull desde la última marca y actualiza la copia local.
 * Un fallo de red detiene el envío para conservar el orden; se reintenta en el siguiente disparo.
 */
const LOTE = 50;
const PAGINAS_MAX = 20;

/** Errores que no son culpa de la operación: se reintenta más tarde sin marcarla con error. */
export function esTemporal(err) {
  return !err || err.codigo === 'SIN_CONEXION' || !err.status || err.status >= 500 || err.status === 401 || err.status === 429;
}

const errorDe = (e) => ({ codigo: e.codigo, mensaje: e.mensaje || e.message, detalles: e.detalles });

async function enviarPublicacion(op, resumen) {
  await marcarEnviando([op.id]);
  try {
    const r = await api.publicarProducto(op.payload, { foto: { uri: op.archivos.foto }, miniatura: { uri: op.archivos.miniatura } });
    await guardarProductos([r.producto]);
    await quitarPublicada(op.id, { idEntidad: op.idEntidad, versionNueva: r.producto.version });
    await borrarFotosCola(op.archivos);
    resumen.publicadas += 1;
    return true;
  } catch (err) {
    if (esTemporal(err)) {
      await devolverAPendiente([op.id]);
      return false;
    }
    await marcarConError(op.id, errorDe(err));
    resumen.conError += 1;
    return true;
  }
}

async function enviarLote(lote, resumen) {
  const ids = lote.map((o) => o.id);
  await marcarEnviando(ids);
  let respuesta;
  try {
    respuesta = await api.syncPush(lote.map((o) => ({
      idOperacion: o.id, tipo: `${o.entidad}.${o.tipo}`, idEntidad: o.idEntidad, datos: o.payload, creadoEn: o.creadoEn,
    })));
  } catch (err) {
    if (esTemporal(err)) {
      await devolverAPendiente(ids);
      return false;
    }
    for (const id of ids) await marcarConError(id, errorDe(err)); // lote rechazado completo (400)
    resumen.conError += ids.length;
    return true;
  }

  let seguir = true;
  for (const r of respuesta.resultados) {
    const op = lote.find((o) => o.id === r.idOperacion);
    if (!op) continue;
    if (r.resultado === 'PUBLICADO' || r.resultado === 'YA_APLICADA') {
      if (r.producto) await guardarProductos([r.producto]);
      if (r.mensaje) await guardarMensajes([r.mensaje]);
      if (r.calificacion && op.entidad === 'CALIFICACION') await guardarCalificacionLocal(op.idEntidad, r.calificacion);
      await quitarPublicada(op.id, { idEntidad: op.idEntidad, versionNueva: r.producto && r.producto.version });
      resumen.publicadas += 1;
    } else if (r.resultado === 'CON_ERROR') {
      // CU-17 A2: prevalece el servidor; la copia local toma la versión vigente.
      if (r.error && r.error.detalles && r.error.detalles.producto) await guardarProductos([r.error.detalles.producto]);
      await marcarConError(op.id, r.error || { codigo: 'RECHAZADA', mensaje: 'El servidor rechazó el cambio.' });
      resumen.conError += 1;
    } else {
      await devolverAPendiente([op.id]);
      seguir = false;
    }
  }
  return seguir;
}

/** Paso 3: envía la cola. Devuelve false si se detuvo por falta de red. */
export async function enviarCola(resumen) {
  const ops = await pendientesEnOrden();
  let i = 0;
  const conFoto = (op) => op.entidad === 'PRODUCTO' && op.tipo === 'CREAR';
  while (i < ops.length) {
    if (conFoto(ops[i])) {
      if (!(await enviarPublicacion(ops[i], resumen))) return false;
      i += 1;
    } else {
      const lote = [];
      while (i < ops.length && !conFoto(ops[i]) && lote.length < LOTE) lote.push(ops[i++]);
      if (!(await enviarLote(lote, resumen))) return false;
    }
  }
  return true;
}

/** Paso 4: descarga lo cambiado desde la última sincronización y guarda la nueva marca. */
export async function descargarCambios() {
  const desde = await leerMeta('ultima_sincronizacion');
  let params = desde ? { desde } : {};
  let marca = null;
  for (let pagina = 0; pagina < PAGINAS_MAX; pagina += 1) {
    const r = await api.syncPull(params);
    if (pagina === 0) marca = r.servidorEn;
    await aplicarPull(r, { primeraPagina: pagina === 0 });
    if (!r.hayMas || !r.siguiente) break;
    params = r.siguiente;
  }
  await guardarMeta('ultima_sincronizacion', marca);
  await guardarMeta('ultima_sincronizacion_local', new Date().toISOString());
}

/** Un ciclo completo. Nunca lanza: devuelve el resumen para la interfaz. */
export async function sincronizarAhora() {
  const resumen = { publicadas: 0, conError: 0, completo: false };
  try {
    if (await enviarCola(resumen)) {
      await descargarCambios();
      resumen.completo = true;
    }
  } catch (err) {
    resumen.error = err;
  }
  return resumen;
}
