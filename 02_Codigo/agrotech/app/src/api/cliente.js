import { Platform } from 'react-native';
import { resolverUrlApi } from './servidor';

/**
 * Cliente HTTP de la API REST de AgroTech.
 * - URL base: EXPO_PUBLIC_API_URL o, con "auto", el mismo computador que sirve la app (ver servidor.js).
 * - Tiempo de espera para redes 3G intermitentes.
 * - Normaliza los errores al formato de la API: { codigo, mensaje, detalles }.
 * - Agrega "Authorization: Bearer <token>" cuando hay sesión (AGRO-5).
 */
export const API_URL = resolverUrlApi();
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

/** El canal de tiempo real (WebSocket) se autentica con el mismo token. */
export const tokenVigente = () => tokenActual;
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
  const esFormulario = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api/v1${ruta}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        // Con FormData el motor de red pone el Content-Type multipart con su boundary.
        ...(cuerpo && !esFormulario ? { 'Content-Type': 'application/json' } : {}),
        ...(tokenEnviado ? { Authorization: `Bearer ${tokenEnviado}` } : {}),
        ...cabeceras,
      },
      body: esFormulario ? cuerpo : cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Intente de nuevo cuando tenga señal.', { url: API_URL });
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

/** Arma la cadena de consulta omitiendo vacíos: { municipio: 'Ocaña', pagina: 2 } → "?municipio=Oca%C3%B1a&pagina=2" */
function consulta(params = {}) {
  const partes = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return partes.length ? `?${partes.join('&')}` : '';
}

/**
 * Parte de archivo para FormData. En Android/iOS basta { uri, name, type };
 * en la vista web hay que convertir la URI a Blob.
 */
async function archivo(uri, nombre) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return [blob, nombre];
  }
  return [{ uri, name: nombre, type: 'image/jpeg' }];
}

const TIEMPO_SUBIDA_MS = 60000; // 300 KB por 3G rural

export const api = {
  salud: () => solicitar('/salud', { tiempoEspera: 5000 }),
  registrar: (datos) => solicitar('/auth/registro', { metodo: 'POST', cuerpo: datos }),
  iniciarSesion: (identificador, contrasena) => solicitar('/auth/sesion', { metodo: 'POST', cuerpo: { identificador, contrasena } }),
  yo: () => solicitar('/auth/yo'),
  // Cuenta, perfil y privacidad (Fase 2: AGRO-22, AGRO-23)
  recuperar: (correo) => solicitar('/auth/recuperar', { metodo: 'POST', cuerpo: { correo } }),
  restablecer: (datos) => solicitar('/auth/restablecer', { metodo: 'POST', cuerpo: datos }),
  aceptarAviso: (version) => solicitar('/auth/autorizacion', { metodo: 'POST', cuerpo: { version } }),
  perfil: () => solicitar('/perfil'),
  actualizarPerfil: (cambios) => solicitar('/perfil', { metodo: 'PATCH', cuerpo: cambios }),
  privacidad: () => solicitar('/privacidad'),
  solicitarSupresion: (motivo) => solicitar('/privacidad/supresion', { metodo: 'POST', cuerpo: { confirmar: true, motivo } }),
  desistirSupresion: () => solicitar('/privacidad/supresion', { metodo: 'DELETE' }),
  // Avisos y reportes (AGRO-27, AGRO-28)
  notificaciones: (pagina = 1) => solicitar(`/notificaciones${consulta({ pagina })}`),
  marcarNotificacionesLeidas: (ids) => solicitar('/notificaciones/leidas', { metodo: 'POST', cuerpo: ids ? { ids } : {} }),
  reportar: (reporte) => solicitar('/reportes', { metodo: 'POST', cuerpo: reporte }),
  misReportes: () => solicitar('/reportes/mios'),
  // Panel de administración (AGRO-29 · CU-18)
  admin: {
    resumen: () => solicitar('/admin/resumen'),
    reportes: (estado = 'abiertos') => solicitar(`/admin/reportes${consulta({ estado })}`),
    reporte: (id) => solicitar(`/admin/reportes/${id}`),
    resolver: (id, decision) => solicitar(`/admin/reportes/${id}/resolver`, { metodo: 'POST', cuerpo: decision }),
    usuarios: (filtros) => solicitar(`/admin/usuarios${consulta(filtros)}`),
    usuario: (id) => solicitar(`/admin/usuarios/${id}`),
    verificar: (id, verificado = true) => solicitar(`/admin/usuarios/${id}/verificar`, { metodo: 'POST', cuerpo: { verificado } }),
    suspender: (id, motivo, confirmar) => solicitar(`/admin/usuarios/${id}/suspender`, { metodo: 'POST', cuerpo: { motivo, confirmar } }),
    reactivar: (id) => solicitar(`/admin/usuarios/${id}/reactivar`, { metodo: 'POST' }),
    supresiones: () => solicitar('/admin/supresiones'),
    bitacora: (limite = 100) => solicitar(`/admin/bitacora${consulta({ limite })}`),
  },

  // Productos (AGRO-6, AGRO-7, AGRO-18)
  catalogo: (filtros) => solicitar(`/productos${consulta(filtros)}`),
  producto: (id) => solicitar(`/productos/${id}`),
  misProductos: () => solicitar('/productos/mios'),
  editarProducto: (id, cambios) => solicitar(`/productos/${id}`, { metodo: 'PATCH', cuerpo: cambios }),
  cambiarEstadoProducto: (id, accion, version) => solicitar(`/productos/${id}/estado`, { metodo: 'PATCH', cuerpo: { accion, version } }),
  // Pedidos y pagos (AGRO-8, AGRO-9, AGRO-19, AGRO-21)
  confirmarPedido: (clave, cuerpo) => solicitar('/pedidos', { metodo: 'POST', cuerpo, cabeceras: { 'Idempotency-Key': clave }, tiempoEspera: 20000 }),
  // RF-15: acepta 'activos' | 'finalizados' | 'todos' o { estado, desde, hasta, pagina }.
  pedidos: (filtro = 'activos') => solicitar(`/pedidos${consulta(typeof filtro === 'string' ? { estado: filtro } : filtro)}`),
  cancelarPedido: (id, motivo, version) => solicitar(`/pedidos/${id}/cancelar`, { metodo: 'POST', cuerpo: { motivo, version } }),
  pedido: (id) => solicitar(`/pedidos/${id}`),
  cambiarEstadoPedido: (id, cuerpo) => solicitar(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo }),
  iniciarPago: (id) => solicitar(`/pedidos/${id}/pago`, { metodo: 'POST' }),
  cambiarAContraEntrega: (id) => solicitar(`/pedidos/${id}/pago`, { metodo: 'PATCH', cuerpo: { metodoPago: 'CONTRA_ENTREGA' } }),
  // Chat, calificaciones, ventas y dispositivos (AGRO-11, 12, 13, 20)
  mensajes: (idPedido, despuesDe) => solicitar(`/pedidos/${idPedido}/mensajes${consulta({ despuesDe })}`),
  enviarMensaje: (idPedido, mensaje) => solicitar(`/pedidos/${idPedido}/mensajes`, { metodo: 'POST', cuerpo: mensaje }),
  marcarLeidos: (idPedido) => solicitar(`/pedidos/${idPedido}/mensajes/leidos`, { metodo: 'POST' }),
  conversaciones: () => solicitar('/mensajes'),
  calificar: (idPedido, cuerpo) => solicitar(`/pedidos/${idPedido}/calificacion`, { metodo: 'POST', cuerpo }),
  opiniones: (idProductor, pagina = 1) => solicitar(`/productores/${idProductor}/calificaciones${consulta({ pagina })}`),
  ventas: (params) => solicitar(`/ventas${consulta(params)}`),
  registrarDispositivo: (token) => solicitar('/dispositivos', { metodo: 'POST', cuerpo: { token, plataforma: 'ANDROID' } }),
  borrarDispositivo: (token) => solicitar(`/dispositivos/${encodeURIComponent(token)}`, { metodo: 'DELETE', tiempoEspera: 4000 }),
  // Sincronización sin conexión (AGRO-10)
  syncPush: (operaciones) => solicitar('/sync/push', { metodo: 'POST', cuerpo: { operaciones }, tiempoEspera: 30000 }),
  syncPull: (params = {}) => solicitar(`/sync/pull${consulta(params)}`, { tiempoEspera: 30000 }),
  async publicarProducto(datos, { foto, miniatura }) {
    const formulario = new FormData();
    formulario.append('datos', JSON.stringify(datos));
    formulario.append('foto', ...(await archivo(foto.uri, 'foto.jpg')));
    formulario.append('miniatura', ...(await archivo(miniatura.uri, 'miniatura.jpg')));
    return solicitar('/productos', { metodo: 'POST', cuerpo: formulario, tiempoEspera: TIEMPO_SUBIDA_MS });
  },
  /** CU-09 paso 2: foto de perfil (JPEG ≤ 300 KB, ya comprimida en el teléfono). PUT /perfil/foto. */
  async cambiarFotoPerfil(uri) {
    const formulario = new FormData();
    formulario.append('foto', ...(await archivo(uri, 'perfil.jpg')));
    return solicitar('/perfil/foto', { metodo: 'PUT', cuerpo: formulario, tiempoEspera: TIEMPO_SUBIDA_MS });
  },
};
