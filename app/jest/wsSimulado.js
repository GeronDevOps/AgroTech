/**
 * WebSocket simulado para las pruebas: hace de servidor de tiempo real.
 * - Al abrir, la app envía { tipo: 'autenticar' }; el simulador responde { tipo: 'listo' }.
 * - global.__ws.emitir(evento) entrega un evento a todas las conexiones autenticadas.
 */
class WebSocketSimulado {
  static CONNECTING = 0;

  static OPEN = 1;

  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.enviados = [];
    global.__ws.conexiones.add(this);
    setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      if (this.onopen) this.onopen({});
    }, 0);
  }

  send(texto) {
    const datos = JSON.parse(texto);
    this.enviados.push(datos);
    if (datos.tipo === 'autenticar') {
      this.autenticado = true;
      setTimeout(() => this.recibir({ tipo: 'listo' }), 0);
    }
  }

  recibir(datos) {
    if (this.readyState === 1 && this.onmessage) this.onmessage({ data: JSON.stringify(datos) });
  }

  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    global.__ws.conexiones.delete(this);
    if (this.onclose) this.onclose({ code });
  }
}

global.__ws = {
  conexiones: new Set(),
  emitir(datos) { for (const c of [...global.__ws.conexiones]) if (c.autenticado) c.recibir(datos); },
  autenticadas: () => [...global.__ws.conexiones].filter((c) => c.autenticado),
  reiniciar() { for (const c of [...global.__ws.conexiones]) c.close(); global.__ws.conexiones.clear(); },
};
global.WebSocket = WebSocketSimulado;
