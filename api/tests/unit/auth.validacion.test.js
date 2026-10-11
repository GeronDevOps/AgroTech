'use strict';

const { validarRegistro, validarSesion, normalizarTelefono, errorContrasena } = require('../../src/modules/auth/auth.validacion');

const valido = {
  nombres: '  Rosa  Elena ', apellidos: 'Peñaranda', correo: ' Rosa@Correo.CO ', telefono: '+57 310 555 1234',
  contrasena: 'cosecha2026', rol: 'productor', municipio: 'pamplonita', aceptaTratamientoDatos: true,
};

const camposConError = (fn) => {
  try { fn(); } catch (e) { return e.detalles.campos; }
  throw new Error('se esperaba un error de validación');
};

describe('validarRegistro (CU-01)', () => {
  test('normaliza los datos válidos', () => {
    expect(validarRegistro(valido)).toMatchObject({
      nombres: 'Rosa Elena', correo: 'rosa@correo.co', telefono: '3105551234',
      rol: 'PRODUCTOR', municipio: 'Pamplonita', veredaDireccion: null,
    });
  });

  test('marca cada campo inválido (A2)', () => {
    const campos = camposConError(() => validarRegistro({ nombres: 'R', correo: 'x', telefono: '12345', contrasena: 'corta', rol: 'ADMINISTRADOR', municipio: 'Bogotá' }));
    expect(Object.keys(campos).sort()).toEqual(
      ['aceptaTratamientoDatos', 'apellidos', 'contrasena', 'correo', 'municipio', 'nombres', 'rol', 'telefono'],
    );
  });

  test('sin autorización de datos no se crea la cuenta (A3)', () => {
    expect(camposConError(() => validarRegistro({ ...valido, aceptaTratamientoDatos: 'true' })))
      .toHaveProperty('aceptaTratamientoDatos');
  });
});

describe('reglas auxiliares', () => {
  test.each([['310 555 1234', '3105551234'], ['+573105551234', '3105551234'], ['573105551234', '3105551234']])(
    'normaliza el celular %s', (entrada, salida) => expect(normalizarTelefono(entrada)).toBe(salida),
  );

  test('política de contraseñas', () => {
    expect(errorContrasena('abc12345')).toBeNull();
    expect(errorContrasena('abcdefgh')).toMatch(/número/);
    expect(errorContrasena('12345678')).toMatch(/letra/);
    expect(errorContrasena('a1'.repeat(40))).toMatch(/72/);
  });

  test('validarSesion distingue correo y celular', () => {
    expect(validarSesion({ identificador: 'ROSA@correo.co', contrasena: 'x' }).identificador).toEqual({ tipo: 'correo', valor: 'rosa@correo.co' });
    expect(validarSesion({ identificador: '310-555-1234', contrasena: 'x' }).identificador).toEqual({ tipo: 'telefono', valor: '3105551234' });
    expect(camposConError(() => validarSesion({}))).toEqual(expect.objectContaining({ identificador: expect.any(String), contrasena: expect.any(String) }));
  });
});
