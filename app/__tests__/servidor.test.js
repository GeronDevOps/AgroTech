import { diagnosticoServidor, resolverUrlApi } from '../src/api/servidor';

// "No hay conexión con el servidor": la IP escrita a mano en app/.env cambia con el router.
// Con "auto" la app busca la API en el mismo computador que le sirve el código (Metro).
describe('Dirección de la API', () => {
  test('una URL explícita se respeta (builds de producción)', () => {
    expect(resolverUrlApi({ configurada: 'https://api.agrotech.co/', plataforma: 'android', hostMetro: '192.168.1.31' })).toBe('https://api.agrotech.co');
  });

  test.each([undefined, '', 'auto', ' AUTO '])('con %p en Expo Go usa la IP del computador que sirve la app', (configurada) => {
    expect(resolverUrlApi({ configurada, plataforma: 'android', hostMetro: '192.168.1.31' })).toBe('http://192.168.1.31:3000');
  });

  test('en la vista web usa el mismo host de la página', () => {
    expect(resolverUrlApi({ configurada: 'auto', plataforma: 'web', hostWeb: 'localhost', protocoloWeb: 'http:' })).toBe('http://localhost:3000');
    expect(resolverUrlApi({ configurada: 'auto', plataforma: 'web', hostWeb: '192.168.1.31', protocoloWeb: 'http:' })).toBe('http://192.168.1.31:3000');
  });

  test('sin pistas cae en localhost', () => {
    expect(resolverUrlApi({ configurada: 'auto', plataforma: 'android', hostMetro: null })).toBe('http://localhost:3000');
  });
});

describe('Diagnóstico del servidor en la bienvenida', () => {
  const url = 'http://192.168.1.31:3000';
  test('conectado', () => {
    expect(diagnosticoServidor({ ok: true, datos: { baseDeDatos: { migracion: '006' } } }, url)).toBe(`Servidor: conectado (${url}) · migración 006`);
  });
  test('sin respuesta: dice a qué dirección intentó llegar y qué revisar', () => {
    const t = diagnosticoServidor({ ok: false, error: { status: 0, codigo: 'SIN_CONEXION' } }, url);
    expect(t).toContain(url);
    expect(t).toMatch(/misma red Wi-Fi/);
    expect(t).toMatch(/Firewall/);
  });
  test('API encendida sin base de datos (503)', () => {
    expect(diagnosticoServidor({ ok: false, error: { status: 503, codigo: 'ERROR_DESCONOCIDO' } }, url)).toMatch(/sin base de datos/);
  });
});
