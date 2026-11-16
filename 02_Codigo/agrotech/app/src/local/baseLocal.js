import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

/**
 * Base local SQLite del teléfono (Entrega 3, Ilustración 9 · RF-17 / CU-17).
 * - cola_operaciones: cambios hechos sin señal, en orden cronológico (estado PENDIENTE / ENVIANDO / CON_ERROR;
 *   al publicarse se eliminan).
 * - cache_producto / cache_pedido: copia de lo último recibido del servidor. Las columnas de filtro
 *   (municipio, categoría, precio…) se derivan de `datos` para filtrar el catálogo sin red.
 * - carrito_local: el carrito persiste aunque se cierre la app (CU-04 sin red).
 * - cache_mensaje: historial del chat por pedido (CU-05), para leerlo sin señal.
 * - meta_sync: marca de la última sincronización, clave del carrito, último panel de ventas y versión del esquema.
 * El token JWT NO se guarda aquí (almacén seguro del sistema).
 */
const NOMBRE = 'agrotech-local.db';

const MIGRACIONES = [
  `CREATE TABLE IF NOT EXISTS cola_operaciones (
     id_operacion TEXT PRIMARY KEY NOT NULL,
     tipo TEXT NOT NULL,
     entidad TEXT NOT NULL,
     id_entidad TEXT NOT NULL,
     payload TEXT NOT NULL,
     ruta_local_archivo TEXT,
     estado TEXT NOT NULL DEFAULT 'PENDIENTE',
     intentos INTEGER NOT NULL DEFAULT 0,
     error TEXT,
     creado_en TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS ix_cola_estado ON cola_operaciones (estado, creado_en);
   CREATE INDEX IF NOT EXISTS ix_cola_entidad ON cola_operaciones (id_entidad);
   CREATE TABLE IF NOT EXISTS cache_producto (
     id_producto TEXT PRIMARY KEY NOT NULL,
     id_productor TEXT NOT NULL,
     estado TEXT NOT NULL,
     municipio TEXT NOT NULL,
     categoria TEXT NOT NULL,
     precio REAL NOT NULL,
     stock REAL NOT NULL,
     fecha_publicacion TEXT NOT NULL,
     datos TEXT NOT NULL,
     foto_local TEXT,
     version INTEGER NOT NULL,
     actualizado_en TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS ix_cache_producto_catalogo ON cache_producto (estado, municipio, categoria);
   CREATE INDEX IF NOT EXISTS ix_cache_producto_productor ON cache_producto (id_productor);
   CREATE TABLE IF NOT EXISTS cache_pedido (
     id_pedido TEXT PRIMARY KEY NOT NULL,
     estado TEXT NOT NULL,
     fecha TEXT NOT NULL,
     datos TEXT NOT NULL,
     version INTEGER NOT NULL,
     actualizado_en TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS carrito_local (
     id_producto TEXT PRIMARY KEY NOT NULL,
     cantidad REAL NOT NULL,
     agregado_en TEXT NOT NULL
   );`,
  // Versión 2 (AGRO-11): historial del chat para leerlo sin señal (CU-05).
  `CREATE TABLE IF NOT EXISTS cache_mensaje (
     id_mensaje TEXT PRIMARY KEY NOT NULL,
     id_pedido TEXT NOT NULL,
     fecha TEXT NOT NULL,
     datos TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS ix_cache_mensaje_pedido ON cache_mensaje (id_pedido, fecha);`,
];

let apertura = null;
let colaTransacciones = Promise.resolve();

/**
 * Transacción serializada. En el teléfono, withExclusiveTransactionAsync aísla la transacción en su propia conexión;
 * la vista web (wa-sqlite) no la soporta y usa withTransactionAsync. En ambos casos una cola en JS evita que dos
 * transacciones de la app se mezclen. No se deben anidar.
 */
function transaccionSerializada(db, fn) {
  const ejecutar = async () => {
    let resultado;
    if (Platform.OS === 'web') await db.withTransactionAsync(async () => { resultado = await fn(db); });
    else await db.withExclusiveTransactionAsync(async (tx) => { resultado = await fn(tx); });
    return resultado;
  };
  const r = colaTransacciones.then(ejecutar, ejecutar);
  colaTransacciones = r.catch(() => {});
  return r;
}

async function abrir() {
  const db = await SQLite.openDatabaseAsync(NOMBRE);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS meta_sync (clave TEXT PRIMARY KEY NOT NULL, valor TEXT);');
  const fila = await db.getFirstAsync("SELECT valor FROM meta_sync WHERE clave = 'version_esquema'");
  let version = fila ? Number(fila.valor) : 0;
  while (version < MIGRACIONES.length) {
    const siguiente = version + 1;
    const sql = MIGRACIONES[version];
    await transaccionSerializada(db, async (tx) => {
      await tx.execAsync(sql);
      await tx.runAsync("INSERT OR REPLACE INTO meta_sync (clave, valor) VALUES ('version_esquema', ?)", String(siguiente));
    });
    version = siguiente;
  }
  // Una operación que quedó "Enviando" (app cerrada en pleno envío) vuelve a la cola: reenviarla es seguro (idempotente).
  await db.runAsync("UPDATE cola_operaciones SET estado = 'PENDIENTE' WHERE estado = 'ENVIANDO'");
  return db;
}

/** Conexión única y perezosa. */
export function baseLocal() {
  if (!apertura) {
    apertura = abrir().catch((err) => {
      apertura = null;
      throw err;
    });
  }
  return apertura;
}

/** Ejecuta `fn(tx)` en una transacción exclusiva y devuelve su resultado. */
export async function enTransaccion(fn) {
  return transaccionSerializada(await baseLocal(), fn);
}

export async function leerMeta(clave) {
  const db = await baseLocal();
  const fila = await db.getFirstAsync('SELECT valor FROM meta_sync WHERE clave = ?', clave);
  return fila ? fila.valor : null;
}

export async function guardarMeta(clave, valor) {
  const db = await baseLocal();
  if (valor === null || valor === undefined) await db.runAsync('DELETE FROM meta_sync WHERE clave = ?', clave);
  else await db.runAsync('INSERT OR REPLACE INTO meta_sync (clave, valor) VALUES (?, ?)', clave, String(valor));
}

/** Al cerrar sesión: el teléfono puede ser compartido, no quedan datos del usuario anterior. */
export async function borrarDatosLocales() {
  await enTransaccion(async (tx) => {
    await tx.execAsync(`DELETE FROM cola_operaciones; DELETE FROM cache_producto; DELETE FROM cache_pedido; DELETE FROM cache_mensaje;
                        DELETE FROM carrito_local; DELETE FROM meta_sync WHERE clave <> 'version_esquema';`);
  });
}

/** Solo pruebas: la siguiente llamada abre una base nueva. */
export function reiniciarBaseLocalParaPruebas() {
  apertura = null;
  colaTransacciones = Promise.resolve();
}
