'use strict';

const { WebSocketServer } = require('ws');

const PLAZO_AUTENTICACION_MS = 5000;
const LATIDO_MS = 30000;

/** Códigos de cierre propios (rango 4000–4999 de la RFC 6455). */
const CIERRE = Object.freeze({ SIN_AUTENTICAR: 4001, TOKEN_INVALIDO: 4002, MENSAJE_INVALIDO: 4003 });

/**
 * Servidor WebSocket de AgroTech (Entrega 3: "tiempo real separado", mismo proceso Node.js que la API).
 * - El cliente se conecta a /ws y en los primeros 5 s envía { tipo: 'autenticar', token } con su JWT
 *   (el token no viaja en la URL, que queda en registros de proxies).
 * - El servidor solo empuja eventos; los cambios siguen entrando por la API REST.
 * - Eventos del bus → mensajes a las partes del pedido:
 *     nuevo_pedido        → productor        { tipo: 'pedido_nuevo', idPedido }            (CU-04 paso 4, CA-06)
 *     estado_pedido       → ambas partes     { tipo: 'pedido_actualizado', idPedido, estado } (CA-08)
 *     pago_actualizado    → ambas partes     { tipo: 'pedido_actualizado', idPedido, estadoPago }
 *     mensaje_nuevo       → ambas partes     { tipo: 'mensaje', mensaje }                   (CU-05 paso 3, CA-09)
 *     mensajes_leidos     → ambas partes     { tipo: 'mensajes_leidos', idPedido, idLector, ids }
 *     calificacion_nueva  → productor        { tipo: 'calificacion', idPedido, reputacion }
 */
function createServidorTiempoReal({ server, pool, tokens, eventos, ruta = '/ws', plazoAutenticacionMs = PLAZO_AUTENTICACION_MS }) {
  const wss = new WebSocketServer({ server, path: ruta, maxPayload: 4 * 1024 });
  const conexiones = new Map(); // idUsuario → Set<WebSocket>

  const enviarA = (idUsuario, datos) => {
    const destino = conexiones.get(idUsuario);
    if (!destino) return 0;
    const texto = JSON.stringify(datos);
    for (const ws of destino) if (ws.readyState === ws.OPEN) ws.send(texto);
    return destino.size;
  };
  const enviarAPartes = (partes, datos) => [...new Set(partes)].forEach((id) => enviarA(id, datos));

  async function partesDe(idPedido) {
    const { rows } = await pool.query('SELECT id_consumidor, id_productor FROM pedido WHERE id_pedido = $1', [idPedido]);
    return rows[0] ? [rows[0].id_consumidor, rows[0].id_productor] : [];
  }

  wss.on('connection', (ws) => {
    ws.vivo = true;
    ws.on('pong', () => { ws.vivo = true; });
    const plazo = setTimeout(() => ws.close(CIERRE.SIN_AUTENTICAR, 'Autenticación requerida'), plazoAutenticacionMs);

    ws.on('message', (bruto) => {
      let datos;
      try { datos = JSON.parse(bruto.toString()); } catch { return ws.close(CIERRE.MENSAJE_INVALIDO, 'JSON inválido'); }
      if (ws.usuario) {
        if (datos && datos.tipo === 'ping') ws.send(JSON.stringify({ tipo: 'pong' }));
        return undefined;
      }
      if (!datos || datos.tipo !== 'autenticar' || typeof datos.token !== 'string') return ws.close(CIERRE.SIN_AUTENTICAR, 'Autenticación requerida');
      try {
        ws.usuario = tokens.verificar(datos.token);
      } catch {
        return ws.close(CIERRE.TOKEN_INVALIDO, 'Token inválido o vencido');
      }
      clearTimeout(plazo);
      if (!conexiones.has(ws.usuario.id)) conexiones.set(ws.usuario.id, new Set());
      conexiones.get(ws.usuario.id).add(ws);
      ws.send(JSON.stringify({ tipo: 'listo', usuario: ws.usuario.id }));
      return undefined;
    });

    ws.on('close', () => {
      clearTimeout(plazo);
      if (!ws.usuario) return;
      const set = conexiones.get(ws.usuario.id);
      if (set) {
        set.delete(ws);
        if (!set.size) conexiones.delete(ws.usuario.id);
      }
    });
    ws.on('error', () => {});
  });

  // Conexiones caídas sin cierre (señal rural intermitente): latido cada 30 s.
  const latido = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.vivo) { ws.terminate(); continue; }
      ws.vivo = false;
      ws.ping();
    }
  }, LATIDO_MS);
  latido.unref();

  const manejadores = {
    nuevo_pedido: ({ idPedido, idProductor }) => enviarA(idProductor, { tipo: 'pedido_nuevo', idPedido }),
    estado_pedido: async ({ idPedido, estado }) => enviarAPartes(await partesDe(idPedido), { tipo: 'pedido_actualizado', idPedido, estado }),
    pago_actualizado: async ({ idPedido, estado }) => enviarAPartes(await partesDe(idPedido), { tipo: 'pedido_actualizado', idPedido, estadoPago: estado }),
    mensaje_nuevo: ({ mensaje, partes }) => enviarAPartes(partes, { tipo: 'mensaje', mensaje }),
    mensajes_leidos: ({ idPedido, idLector, ids, partes }) => enviarAPartes(partes, { tipo: 'mensajes_leidos', idPedido, idLector, ids }),
    calificacion_nueva: ({ idPedido, idProductor, reputacion }) => enviarA(idProductor, { tipo: 'calificacion', idPedido, reputacion }),
  };
  const oyentes = Object.entries(manejadores).map(([evento, fn]) => {
    const oyente = (datos) => Promise.resolve(fn(datos)).catch((err) => console.error(`[ws] ${evento}:`, err.message));
    eventos.on(evento, oyente);
    return [evento, oyente];
  });

  return {
    conectados: () => [...conexiones.values()].reduce((n, s) => n + s.size, 0),
    cerrar() {
      clearInterval(latido);
      oyentes.forEach(([evento, oyente]) => eventos.off(evento, oyente));
      for (const ws of wss.clients) ws.terminate();
      return new Promise((resolve) => { wss.close(() => resolve()); });
    },
  };
}

module.exports = { createServidorTiempoReal, CIERRE };
