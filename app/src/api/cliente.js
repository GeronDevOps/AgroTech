/**
 * Cliente HTTP de la API REST de AgroTech.
 * - URL base desde EXPO_PUBLIC_API_URL (archivo .env de la app).
 * - Tiempo de espera para redes 3G intermitentes.
 * - Normaliza los errores al formato de la API: { codigo, mensaje, detalles }.
 * - Agrega "Authorization: Bearer <token>" cuando hay sesión (AGRO-5).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TIEMPO_ESPERA_MS = 10000;
const CODIGOS_SESION_INVALIDA = ['SESION_EXPIRADA', 'NO_AUTENTICADO'];

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

let tokenActual = null;
let alRechazar = null;

/** Lo llama la sesión al iniciar o cerrar sesión. */
export function establecerToken(token) {
  tokenActual = token || null;
}

/** Callback cuando el servidor rechaza el token enviado (vencido o inválido). */
export function alRechazarSesion(callback) {
  alRechazar = callback;
}

export async function solicitar(ruta, { metodo = 'GET', cuerpo, cabeceras = {}, tiempoEspera = TIEMPO_ESPERA_MS } = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoEspera);
  const tokenEnviado = tokenActual;
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api/v1${ruta}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
        ...(tokenEnviado ? { Authorization: `Bearer ${tokenEnviado}` } : {}),
        ...cabeceras,
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Intente de nuevo cuando tenga señal.');
  } finally {
    clearTimeout(temporizador);
  }

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try { datos = JSON.parse(texto); } catch { datos = null; }
  }
  if (!respuesta.ok) {
    const e = (datos && datos.error) || {};
    const error = new ErrorApi(respuesta.status, e.codigo || 'ERROR_DESCONOCIDO', e.mensaje || 'Ocurrió un error inesperado.', e.detalles);
    if (tokenEnviado && respuesta.status === 401 && CODIGOS_SESION_INVALIDA.includes(error.codigo) && alRechazar) {
      alRechazar(error);
    }
    throw error;
  }
  return datos;
}

export const api = {
  salud: () => solicitar('/salud', { tiempoEspera: 5000 }),
  registrar: (datos) => solicitar('/auth/registro', { metodo: 'POST', cuerpo: datos }),
  iniciarSesion: (identificador, contrasena) => solicitar('/auth/sesion', { metodo: 'POST', cuerpo: { identificador, contrasena } }),
  yo: () => solicitar('/auth/yo'),
};
