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
