import * as Crypto from 'expo-crypto';
import { baseLocal, enTransaccion } from './baseLocal';

/**
 * Cola de operaciones sin conexión (CU-17 paso 2; diagrama de estados c, Entrega 3).
 * PENDIENTE → ENVIANDO → (publicada: se elimina) | CON_ERROR (motivo; corregir/reintentar o descartar).
 * Un fallo de red devuelve la operación a PENDIENTE con un intento más.
 */
export const ESTADOS_COLA = Object.freeze({ PENDIENTE: 'PENDIENTE', ENVIANDO: 'ENVIANDO', CON_ERROR: 'CON_ERROR' });

const leerJson = (t) => (t ? JSON.parse(t) : null);

function aOperacion(f) {
  return {
    id: f.id_operacion,
    tipo: f.tipo,
    entidad: f.entidad,
    idEntidad: f.id_entidad,
    payload: leerJson(f.payload),
    archivos: leerJson(f.ruta_local_archivo),
    estado: f.estado,
    intentos: f.intentos,
    error: leerJson(f.error),
    creadoEn: f.creado_en,
  };
}

async function insertar(db, { tipo, entidad, idEntidad, payload, archivos = null }) {
  const op = { id: Crypto.randomUUID(), creadoEn: new Date().toISOString() };
  await db.runAsync(
    `INSERT INTO cola_operaciones (id_operacion, tipo, entidad, id_entidad, payload, ruta_local_archivo, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    op.id, tipo, entidad, idEntidad, JSON.stringify(payload), archivos ? JSON.stringify(archivos) : null, op.creadoEn,
  );
  return op.id;
}

/** CU-02 sin red: la publicación completa (datos con el id del teléfono + fotos guardadas en el teléfono). */
export async function encolarPublicacion(datos, archivos) {
  const db = await baseLocal();
  return insertar(db, { tipo: 'CREAR', entidad: 'PRODUCTO', idEntidad: datos.id, payload: datos, archivos });
}

/**
 * RF-10a sin red. Se combina con lo que aún no salió del teléfono para no generar conflictos consigo mismo:
 * - si la publicación también está en cola (CREAR pendiente o con error), se corrigen sus datos y vuelve a la cola;
 * - si ya hay una edición pendiente, se le suman los cambios;
 * - una edición con error se reemplaza (el usuario la corrigió: CU-17 A1).
 * `version` es la que el teléfono conoce; si el servidor tiene otra, habrá conflicto y prevalece el servidor (A2).
 */
export async function encolarEdicion(idProducto, cambios, version) {
  return enTransaccion(async (tx) => {
    const filas = await tx.getAllAsync(
      "SELECT * FROM cola_operaciones WHERE id_entidad = ? AND estado IN ('PENDIENTE', 'CON_ERROR') ORDER BY creado_en",
      idProducto,
    );
    const ops = filas.map(aOperacion);
    const creacion = ops.find((o) => o.tipo === 'CREAR');
    if (creacion) {
      // Corregir una publicación con error la devuelve a la cola (CU-17 A1).
      await tx.runAsync(
        "UPDATE cola_operaciones SET payload = ?, estado = 'PENDIENTE', error = NULL WHERE id_operacion = ?",
        JSON.stringify({ ...creacion.payload, ...cambios }), creacion.id,
      );
      return creacion.id;
    }
    const edicion = ops.find((o) => o.tipo === 'EDITAR' && o.estado === ESTADOS_COLA.PENDIENTE);
    if (edicion) {
      await tx.runAsync('UPDATE cola_operaciones SET payload = ? WHERE id_operacion = ?', JSON.stringify({ ...edicion.payload, ...cambios }), edicion.id);
      return edicion.id;
    }
    await tx.runAsync("DELETE FROM cola_operaciones WHERE id_entidad = ? AND tipo = 'EDITAR' AND estado = 'CON_ERROR'", idProducto);
    return insertar(tx, { tipo: 'EDITAR', entidad: 'PRODUCTO', idEntidad: idProducto, payload: { ...cambios, version } });
  });
}

/** CU-05 A1 y CU-06 A3: mensaje o calificación hechos sin señal (JSON, van por /sync/push). */
export async function encolarCreacion(entidad, idEntidad, payload) {
  const db = await baseLocal();
  return insertar(db, { tipo: 'CREAR', entidad, idEntidad, payload });
}

/** Operaciones por enviar, en orden cronológico (CU-17 paso 3). */
export async function pendientesEnOrden() {
  const db = await baseLocal();
  return (await db.getAllAsync("SELECT * FROM cola_operaciones WHERE estado = 'PENDIENTE' ORDER BY creado_en, rowid")).map(aOperacion);
}

/** Todo lo que sigue en el teléfono (pendiente, enviando o con error). */
export async function operacionesEnCola() {
  const db = await baseLocal();
  return (await db.getAllAsync('SELECT * FROM cola_operaciones ORDER BY creado_en, rowid')).map(aOperacion);
}

export async function operacion(id) {
  const db = await baseLocal();
  const f = await db.getFirstAsync('SELECT * FROM cola_operaciones WHERE id_operacion = ?', id);
  return f ? aOperacion(f) : null;
}

export async function resumenCola() {
  const db = await baseLocal();
  const f = await db.getFirstAsync(
    "SELECT SUM(estado <> 'CON_ERROR') AS pendientes, SUM(estado = 'CON_ERROR') AS con_error FROM cola_operaciones",
  );
  return { pendientes: Number((f && f.pendientes) || 0), conError: Number((f && f.con_error) || 0) };
}

export async function marcarEnviando(ids) {
  const db = await baseLocal();
  for (const id of ids) await db.runAsync("UPDATE cola_operaciones SET estado = 'ENVIANDO' WHERE id_operacion = ?", id);
}

/** Fallo de red o del servidor: vuelve a la cola con un intento más. */
export async function devolverAPendiente(ids) {
  const db = await baseLocal();
  for (const id of ids) {
    await db.runAsync("UPDATE cola_operaciones SET estado = 'PENDIENTE', intentos = intentos + 1 WHERE id_operacion = ?", id);
  }
}

export async function marcarConError(id, error) {
  const db = await baseLocal();
  await db.runAsync(
    "UPDATE cola_operaciones SET estado = 'CON_ERROR', intentos = intentos + 1, error = ? WHERE id_operacion = ?",
    JSON.stringify({ codigo: error.codigo, mensaje: error.mensaje || error.message, detalles: error.detalles }),
    id,
  );
}

/** Publicada en el servidor: sale de la cola. Las ediciones siguientes de la misma publicación toman la versión nueva. */
export async function quitarPublicada(id, { idEntidad, versionNueva } = {}) {
  await enTransaccion(async (tx) => {
    await tx.runAsync('DELETE FROM cola_operaciones WHERE id_operacion = ?', id);
    if (idEntidad && versionNueva) {
      await tx.runAsync(
        "UPDATE cola_operaciones SET payload = json_set(payload, '$.version', ?) WHERE id_entidad = ? AND tipo = 'EDITAR' AND estado = 'PENDIENTE'",
        versionNueva, idEntidad,
      );
    }
  });
}

/** CU-17 A1: reintentar tal cual una operación con error. */
export async function reintentarOperacion(id) {
  const db = await baseLocal();
  await db.runAsync("UPDATE cola_operaciones SET estado = 'PENDIENTE', error = NULL WHERE id_operacion = ? AND estado = 'CON_ERROR'", id);
}

/** Descartar: el cambio no se enviará. Devuelve la operación para que se borren sus archivos. */
export async function descartarOperacion(id) {
  const op = await operacion(id);
  const db = await baseLocal();
  await db.runAsync('DELETE FROM cola_operaciones WHERE id_operacion = ?', id);
  return op;
}
