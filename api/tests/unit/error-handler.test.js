'use strict';

const { toHttpError, errorHandler } = require('../../src/middleware/error-handler');
const { errores } = require('../../src/utils/http-error');

function fakeRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('toHttpError: errores de PostgreSQL', () => {
  test.each([
    ['23505', 409, 'DUPLICADO'],
    ['23503', 400, 'DATOS_INVALIDOS'],
    ['23514', 409, 'RESTRICCION_INCUMPLIDA'],
    ['22P02', 400, 'DATOS_INVALIDOS'],
    ['P0001', 409, 'TRANSICION_NO_PERMITIDA'],
  ])('código %s → HTTP %i (%s)', (code, status, codigo) => {
    const e = toHttpError({ code, constraint: 'x', message: 'm' });
    expect(e.status).toBe(status);
    expect(e.codigo).toBe(codigo);
  });

  test('un error desconocido no se traduce', () => {
    expect(toHttpError(new Error('boom'))).toBeNull();
  });
});

describe('errorHandler', () => {
  test('responde con el formato { error: { codigo, mensaje } }', () => {
    const res = fakeRes();
    errorHandler(errores.noEncontrado('No hay'), {}, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'No hay' } });
  });

  test('un error no controlado responde 500 sin exponer detalles', () => {
    const res = fakeRes();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('detalle interno'), {}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('detalle interno');
    spy.mockRestore();
  });
});
