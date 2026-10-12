import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, tokenVigente } from '../api/cliente';
import { useSesion } from '../sesion/SesionContext';
import { useConexion } from '../hooks/useConexion';

/**
 * Canal de tiempo real (servidor WebSocket de la Entrega 3): chat y eventos de pedido mientras la app está abierta.
 * - Se conecta solo con sesión y señal; se autentica con el JWT en el primer mensaje.
 * - Si se cae (señal rural), reintenta con espera creciente: 1, 2, 4… hasta 30 s.
 * - `versionPedidos` aumenta con cada evento de pedido (nuevo, cambio de estado o de pago, calificación recibida)
 *   para que listas, detalles y el panel de ventas se recarguen solos (CA-06, CA-08, CA-10).
 * - Las pantallas se suscriben a los mensajes con `suscribir(fn)` (chat, CA-09).
 */
export const URL_WS = `${API_URL.replace(/^http/, 'ws')}/ws`;
const ESPERA_MAX_MS = 30000;

const TiempoRealContext = createContext(null);

export function TiempoRealProvider({ children }) {
  const { usuario } = useSesion();
  const { enLinea } = useConexion();
  const [conectado, setConectado] = useState(false);
  const [versionPedidos, setVersionPedidos] = useState(0);
  const [ultimoPedidoNuevo, setUltimoPedidoNuevo] = useState(null);
  const oyentes = useRef(new Set());
  const idUsuario = usuario ? usuario.id : null;

  const suscribir = useCallback((fn) => {
    oyentes.current.add(fn);
    return () => oyentes.current.delete(fn);
  }, []);

  useEffect(() => {
    if (!idUsuario || !enLinea || typeof WebSocket === 'undefined') return undefined;
    let ws = null;
    let espera = 1000;
    let temporizador = null;
    let activo = true;

    const conectar = () => {
      ws = new WebSocket(URL_WS);
      ws.onopen = () => {
        espera = 1000;
        ws.send(JSON.stringify({ tipo: 'autenticar', token: tokenVigente() }));
      };
      ws.onmessage = (e) => {
        let datos;
        try { datos = JSON.parse(e.data); } catch { return; }
        if (datos.tipo === 'listo') setConectado(true);
        if (['pedido_nuevo', 'pedido_actualizado', 'calificacion'].includes(datos.tipo)) setVersionPedidos((v) => v + 1);
        if (datos.tipo === 'pedido_nuevo') setUltimoPedidoNuevo({ idPedido: datos.idPedido, recibido: Date.now() });
        oyentes.current.forEach((fn) => fn(datos));
      };
      ws.onclose = (e) => {
        setConectado(false);
        // 4002: token vencido; la sesión la cierra la API REST con su 401. No se insiste.
        if (!activo || e.code === 4002) return;
        temporizador = setTimeout(conectar, espera);
        espera = Math.min(espera * 2, ESPERA_MAX_MS);
      };
      ws.onerror = () => {};
    };
    conectar();

    return () => {
      activo = false;
      clearTimeout(temporizador);
      if (ws) ws.close();
      setConectado(false);
    };
  }, [idUsuario, enLinea]);

  const valor = useMemo(() => ({
    conectado, versionPedidos, ultimoPedidoNuevo, suscribir,
    descartarAvisoPedido: () => setUltimoPedidoNuevo(null),
  }), [conectado, versionPedidos, ultimoPedidoNuevo, suscribir]);

  return <TiempoRealContext.Provider value={valor}>{children}</TiempoRealContext.Provider>;
}

export function useTiempoReal() {
  const ctx = useContext(TiempoRealContext);
  if (!ctx) throw new Error('useTiempoReal debe usarse dentro de <TiempoRealProvider>.');
  return ctx;
}
