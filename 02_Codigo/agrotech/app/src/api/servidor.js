import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Dirección de la API.
 *
 * EXPO_PUBLIC_API_URL en app/.env:
 *  - Una URL completa (https://api.agrotech.co, http://192.168.1.31:3000) se usa tal cual (builds de EAS, servidor fijo).
 *  - "auto" o vacío (desarrollo): la API se busca en el MISMO computador que sirve la app (Metro), puerto 3000.
 *    Así el teléfono con Expo Go no depende de una IP escrita a mano que cambia cada vez que el router la reasigna,
 *    que era la causa del "No hay conexión con el servidor".
 */
export const PUERTO_API = 3000;

export function resolverUrlApi({
  configurada = process.env.EXPO_PUBLIC_API_URL,
  plataforma = Platform.OS,
  hostWeb = typeof window !== 'undefined' && window.location ? window.location.hostname : '',
  protocoloWeb = typeof window !== 'undefined' && window.location ? window.location.protocol : 'http:',
  hostMetro = hostDelServidorDeDesarrollo(),
} = {}) {
  const valor = (configurada || '').trim();
  if (valor && valor.toLowerCase() !== 'auto') return valor.replace(/\/+$/, '');
  if (plataforma === 'web' && hostWeb) return `${protocoloWeb}//${hostWeb}:${PUERTO_API}`;
  if (hostMetro) return `http://${hostMetro}:${PUERTO_API}`;
  return `http://localhost:${PUERTO_API}`;
}

/** Host (sin puerto) desde el que Expo Go / el cliente de desarrollo descargó la app. */
export function hostDelServidorDeDesarrollo() {
  const candidatos = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.manifest?.debuggerHost,
  ];
  const uri = candidatos.find((c) => typeof c === 'string' && c.length > 0);
  if (!uri) return null;
  const host = uri.replace(/^[a-z]+:\/\//i, '').split('/')[0].replace(/:\d+$/, '');
  // Los túneles de Expo (exp.direct) no llevan a la API local.
  return host && !/\.exp\.direct$/.test(host) ? host : null;
}

/** Texto de diagnóstico (solo desarrollo) según la respuesta de GET /salud: a qué dirección se intentó llegar y qué revisar. */
export function diagnosticoServidor(resultado, url) {
  if (resultado.ok) return `Servidor: conectado (${url}) · migración ${resultado.datos.baseDeDatos.migracion}`;
  const e = resultado.error;
  if (e.status === 503) return `Servidor encendido en ${url}, pero sin base de datos: encienda PostgreSQL y revise DATABASE_URL en api/.env.`;
  if (e.codigo === 'SIN_CONEXION') {
    return `Servidor: sin conexión con ${url}. Revise que la API esté encendida (npm start en la carpeta api), `
      + 'que el teléfono esté en la misma red Wi-Fi que el computador y que el Firewall de Windows permita Node.js.';
  }
  return `Servidor: respondió con error (${e.codigo}) en ${url}.`;
}
