'use strict';

const { createSaludService } = require('../../src/modules/salud/salud.service');

describe('saludService.estado', () => {
  test('con base de datos disponible informa ok, latencia y última migración', async () => {
    const service = createSaludService({
      saludRepository: { ping: async () => 2.345, ultimaMigracion: async () => '001' },
    });
    const r = await service.estado();
    expect(r.estado).toBe('ok');
    expect(r.baseDeDatos).toEqual({ estado: 'ok', latenciaMs: 2.3, migracion: '001' });
  });

  test('sin base de datos informa estado degradado', async () => {
    const service = createSaludService({
      saludRepository: { ping: async () => { throw new Error('ECONNREFUSED'); }, ultimaMigracion: async () => null },
    });
    const r = await service.estado();
    expect(r.estado).toBe('degradado');
    expect(r.baseDeDatos.estado).toBe('sin_conexion');
  });
});
