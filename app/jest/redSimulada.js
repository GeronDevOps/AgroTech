/**
 * NetInfo para las pruebas con estado que se puede cambiar (modo avión):
 * global.__red.desconectar() / conectar() notifica a los componentes como lo hace el teléfono.
 */
const { useSyncExternalStore } = require('react');

const EN_LINEA = { type: 'cellular', isConnected: true, isInternetReachable: true, details: { cellularGeneration: '3g' } };
let estado = EN_LINEA;
const oyentes = new Set();
const avisar = () => { for (const f of [...oyentes]) f(estado); };
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };

global.__red = {
  desconectar() { estado = { type: 'none', isConnected: false, isInternetReachable: false, details: null }; avisar(); },
  conectar() { estado = EN_LINEA; avisar(); },
  reiniciar() { estado = EN_LINEA; },
  conectado: () => estado.isConnected !== false,
};

module.exports = {
  useNetInfo: () => useSyncExternalStore(suscribir, () => estado),
  addEventListener: jest.fn((f) => suscribir(f)),
  fetch: jest.fn(async () => estado),
  refresh: jest.fn(async () => estado),
  configure: jest.fn(),
  NetInfoStateType: { none: 'none', cellular: 'cellular', wifi: 'wifi', unknown: 'unknown' },
};
