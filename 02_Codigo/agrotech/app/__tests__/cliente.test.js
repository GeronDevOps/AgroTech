import { solicitar, ErrorApi } from '../src/api/cliente';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) };
}

describe('cliente de la API', () => {
  test('devuelve el JSON de una respuesta correcta', async () => {
    global.fetch = jest.fn(async () => respuesta(200, { estado: 'ok' }));
    await expect(solicitar('/salud')).resolves.toEqual({ estado: 'ok' });
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/salud$/);
  });

  test('convierte el error de la API en ErrorApi con su código', async () => {
    global.fetch = jest.fn(async () => respuesta(409, { error: { codigo: 'STOCK_INSUFICIENTE', mensaje: 'Sin stock' } }));
    await expect(solicitar('/pedidos', { metodo: 'POST', cuerpo: {} })).rejects.toMatchObject({
      status: 409, codigo: 'STOCK_INSUFICIENTE', message: 'Sin stock',
    });
  });

  test('sin red responde SIN_CONEXION', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); });
    const e = await solicitar('/salud').catch((x) => x);
    expect(e).toBeInstanceOf(ErrorApi);
    expect(e.codigo).toBe('SIN_CONEXION');
  });

  test('envía el cuerpo como JSON', async () => {
    global.fetch = jest.fn(async () => respuesta(201, { id: 1 }));
    await solicitar('/algo', { metodo: 'POST', cuerpo: { a: 1 } });
    const [, opciones] = global.fetch.mock.calls[0];
    expect(opciones.method).toBe('POST');
    expect(opciones.headers['Content-Type']).toBe('application/json');
    expect(opciones.body).toBe('{"a":1}');
  });
});

describe('cliente con sesión (AGRO-5)', () => {
  const { establecerToken, alRechazarSesion } = require('../src/api/cliente');
  afterEach(() => { establecerToken(null); alRechazarSesion(null); });

  test('agrega el token en Authorization', async () => {
    establecerToken('abc');
    global.fetch = jest.fn(async () => respuesta(200, {}));
    await solicitar('/auth/yo');
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  test('avisa a la sesión cuando el servidor rechaza el token', async () => {
    establecerToken('vencido');
    const rechazo = jest.fn();
    alRechazarSesion(rechazo);
    global.fetch = jest.fn(async () => respuesta(401, { error: { codigo: 'SESION_EXPIRADA', mensaje: 'x' } }));
    await expect(solicitar('/auth/yo')).rejects.toMatchObject({ codigo: 'SESION_EXPIRADA' });
    expect(rechazo).toHaveBeenCalledTimes(1);
  });

  test('un 401 por credenciales no cierra ninguna sesión', async () => {
    const rechazo = jest.fn();
    alRechazarSesion(rechazo);
    global.fetch = jest.fn(async () => respuesta(401, { error: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'x' } }));
    await expect(solicitar('/auth/sesion', { metodo: 'POST', cuerpo: {} })).rejects.toBeTruthy();
    expect(rechazo).not.toHaveBeenCalled();
  });
});
