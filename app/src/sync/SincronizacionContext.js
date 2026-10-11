import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSesion } from '../sesion/SesionContext';
import { useConexion } from '../hooks/useConexion';
import { leerMeta } from '../local/baseLocal';
import { borrarFotosCola, guardarFotosCola } from '../local/archivosCola';
import {
  descartarOperacion, encolarEdicion, encolarPublicacion, operacionesEnCola, reintentarOperacion, resumenCola,
} from '../local/cola';
import { sincronizarAhora } from './motor';

/**
 * Motor de sincronización en la app (clase MotorSincronizacion, Entrega 3 · CU-17).
 * Disparadores: al iniciar sesión o abrir la app, al recuperar la red, después de encolar algo,
 * cada minuto mientras haya pendientes (reintentos periódicos, plan RSGR del riesgo 1) y al deslizar para actualizar.
 * `version` aumenta al terminar cada ciclo para que las pantallas vuelvan a leer la copia local.
 */
export const INTERVALO_REINTENTO_MS = 60 * 1000;

const SincronizacionContext = createContext(null);

export function SincronizacionProvider({ children }) {
  const { usuario } = useSesion();
  const { enLinea } = useConexion();
  const [estado, setEstado] = useState({ pendientes: 0, conError: 0, sincronizando: false, ultima: null, version: 0 });
  const enCurso = useRef(null);
  const otraVez = useRef(false);
  const enLineaRef = useRef(enLinea);
  const idUsuario = usuario ? usuario.id : null;
  const usuarioRef = useRef(idUsuario);
  useEffect(() => { usuarioRef.current = idUsuario; }, [idUsuario]);

  const refrescar = useCallback(async () => {
    try {
      const r = await resumenCola();
      const ultima = await leerMeta('ultima_sincronizacion_local');
      setEstado((e) => ({ ...e, ...r, ultima }));
    } catch {
      // base local no disponible: la app sigue funcionando en línea
    }
  }, []);

  const sincronizar = useCallback(() => {
    if (!usuarioRef.current) return Promise.resolve(null);
    if (enCurso.current) {
      otraVez.current = true;
      return enCurso.current;
    }
    const ciclo = async () => {
      let resumen;
      do {
        otraVez.current = false;
        setEstado((e) => ({ ...e, sincronizando: true }));
        resumen = await sincronizarAhora();
        await refrescar();
      } while (otraVez.current && usuarioRef.current);
      setEstado((e) => ({ ...e, sincronizando: false, version: e.version + 1 }));
      return resumen;
    };
    enCurso.current = ciclo().finally(() => { enCurso.current = null; });
    return enCurso.current;
  }, [refrescar]);

  // Al iniciar sesión (o abrir la app con la sesión guardada).
  useEffect(() => {
    if (!idUsuario) return undefined;
    let vigente = true;
    // Fuera del render: lee el resumen de la cola y arranca el primer ciclo.
    Promise.resolve().then(async () => {
      await refrescar();
      if (vigente) sincronizar();
    });
    return () => { vigente = false; };
  }, [idUsuario, refrescar, sincronizar]);

  // CU-17 paso 3: al volver la red se envía la cola.
  useEffect(() => {
    const antes = enLineaRef.current;
    enLineaRef.current = enLinea;
    if (enLinea && !antes) sincronizar();
  }, [enLinea, sincronizar]);

  // Reintentos periódicos mientras haya algo pendiente y haya red.
  useEffect(() => {
    if (!enLinea || !estado.pendientes) return undefined;
    const t = setInterval(() => { sincronizar(); }, INTERVALO_REINTENTO_MS);
    return () => clearInterval(t);
  }, [enLinea, estado.pendientes, sincronizar]);

  const despuesDeEncolar = useCallback(async () => {
    await refrescar();
    if (enLineaRef.current) sincronizar();
  }, [refrescar, sincronizar]);

  const valor = useMemo(() => ({
    ...estado,
    sincronizar,
    operaciones: operacionesEnCola,
    /** CU-02 sin red (CA-04): guarda las fotos en el teléfono y encola la publicación. */
    async publicarDespues(datos, fotos) {
      const archivos = await guardarFotosCola(datos.id, fotos);
      await encolarPublicacion(datos, archivos);
      await despuesDeEncolar();
    },
    /** RF-10a sin red. */
    async editarDespues(producto, cambios) {
      await encolarEdicion(producto.id, cambios, producto.version);
      await despuesDeEncolar();
    },
    /** CU-17 A1. */
    async reintentar(idOperacion) {
      await reintentarOperacion(idOperacion);
      await despuesDeEncolar();
    },
    async descartar(idOperacion) {
      const op = await descartarOperacion(idOperacion);
      if (op && op.tipo === 'CREAR') await borrarFotosCola(op.archivos);
      await refrescar();
    },
  }), [estado, sincronizar, despuesDeEncolar, refrescar]);

  return <SincronizacionContext.Provider value={valor}>{children}</SincronizacionContext.Provider>;
}

export function useSincronizacion() {
  const ctx = useContext(SincronizacionContext);
  if (!ctx) throw new Error('useSincronizacion debe usarse dentro de <SincronizacionProvider>.');
  return ctx;
}
