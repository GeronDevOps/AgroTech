import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, alRechazarSesion, establecerToken } from '../api/cliente';
import { borrarSesion, guardarSesion, leerSesion } from './almacen';
import { borrarDatosLocales } from '../local/baseLocal';
import { desregistrarPush } from '../notificaciones/push';

/**
 * Sesión del usuario (AGRO-5 · CU-01, CU-21).
 * - Guarda { token, expiraEn, usuario } en el almacén seguro.
 * - Al abrir la app restaura la sesión SIN depender de la red (usuarios rurales con mala señal)
 *   y la valida en segundo plano con GET /auth/yo: solo un 401 la cierra.
 */
export const ROLES = Object.freeze({ PRODUCTOR: 'PRODUCTOR', CONSUMIDOR: 'CONSUMIDOR', ADMINISTRADOR: 'ADMINISTRADOR' });

const SesionContext = createContext(null);

const vencida = (s) => !s || !s.token || !s.usuario || new Date(s.expiraEn).getTime() <= Date.now();

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = useCallback(async () => {
    await desregistrarPush(); // con el token aún vigente; sin señal no bloquea la salida
    establecerToken(null);
    setSesion(null);
    await borrarSesion();
    await borrarDatosLocales().catch(() => {}); // copia local y cola del usuario que sale
  }, []);

  const abrir = useCallback(async ({ token, expiraEn, usuario, requiereAutorizacion = false, versionAviso = null }) => {
    const nueva = { token, expiraEn, usuario, requiereAutorizacion, versionAviso };
    await guardarSesion(nueva);
    establecerToken(token);
    setSesion(nueva);
    return usuario;
  }, []);

  // Restaurar al iniciar la app.
  useEffect(() => {
    let activo = true;
    alRechazarSesion(() => { cerrarSesion(); });
    (async () => {
      const guardada = await leerSesion();
      if (!activo) return;
      if (vencida(guardada)) {
        if (guardada) await borrarSesion();
        setCargando(false);
        return;
      }
      establecerToken(guardada.token);
      setSesion(guardada);
      setCargando(false);
      try {
        // refresca nombre/municipio y si hay un aviso de privacidad nuevo (CU-20 A3); un 401 dispara cerrarSesion
        const { usuario, requiereAutorizacion = false, versionAviso = null } = await api.yo();
        if (activo) {
          const actualizada = { ...guardada, usuario, requiereAutorizacion, versionAviso };
          setSesion(actualizada);
          await guardarSesion(actualizada);
        }
      } catch {
        // Sin señal u otro error: se conserva la sesión guardada (operación sin conexión, RF-17).
      }
    })();
    return () => { activo = false; };
  }, [cerrarSesion]);

  const valor = useMemo(() => ({
    cargando,
    usuario: sesion ? sesion.usuario : null,
    rol: sesion ? sesion.usuario.rol : null,
    async iniciarSesion(identificador, contrasena) {
      return abrir(await api.iniciarSesion(identificador, contrasena));
    },
    async registrar(datos) {
      return abrir(await api.registrar(datos));
    },
    /** CU-08: tras restablecer la contraseña la API devuelve una sesión nueva. */
    abrirSesion: abrir,
    /** CU-09: el perfil cambió (nombre, celular, municipio…). */
    async actualizarUsuario(cambios) {
      if (!sesion) return;
      const actualizada = { ...sesion, usuario: { ...sesion.usuario, ...cambios } };
      setSesion(actualizada);
      await guardarSesion(actualizada);
    },
    /** CU-20 A3: aviso de privacidad nuevo pendiente de aceptar. */
    requiereAutorizacion: !!(sesion && sesion.requiereAutorizacion),
    versionAviso: sesion ? sesion.versionAviso : null,
    async aceptarAviso() {
      const r = await api.aceptarAviso(sesion.versionAviso);
      const actualizada = { ...sesion, usuario: r.usuario, requiereAutorizacion: false };
      setSesion(actualizada);
      await guardarSesion(actualizada);
    },
    cerrarSesion,
  }), [sesion, cargando, abrir, cerrarSesion]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>.');
  return ctx;
}
