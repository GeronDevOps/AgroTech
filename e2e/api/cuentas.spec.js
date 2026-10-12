// CU-01 · Registro e inicio de sesión (RF-01) y RNF-04 (seguridad)
const { test, expect } = require('@playwright/test');
const { CONTRASENA, auth, crearCuenta, json } = require('../soporte/api');

test.describe('CU-01 · Cuentas', () => {
  test('CP-01: registro con datos válidos y autorización aceptada abre la sesión con su rol', { tag: '@CP-01' }, async ({ request }) => {
    const { token, usuario, correo } = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Pamplonita' });
    expect(usuario).toMatchObject({ rol: 'PRODUCTOR', municipio: 'Pamplonita', correo });
    expect(usuario).not.toHaveProperty('contrasenaHash');
    const yo = await request.get('auth/yo', { headers: auth(token) });
    expect(yo.status()).toBe(200);
    expect((await json(yo)).usuario.id).toBe(usuario.id);

    // A1 y A4: correo repetido y sin autorización no crean cuenta.
    const telefono = () => `3${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const datos = { nombres: 'Luisa', apellidos: 'Prueba', contrasena: CONTRASENA, rol: 'CONSUMIDOR', municipio: 'Pamplona' };
    const repetido = await request.post('auth/registro', { data: { ...datos, correo, telefono: telefono(), aceptaTratamientoDatos: true } });
    expect(repetido.status()).toBe(409);
    expect((await json(repetido)).error).toMatchObject({ codigo: 'CUENTA_EXISTENTE', detalles: { campo: 'correo' } });
    const sinAutorizacion = await request.post('auth/registro', { data: { ...datos, correo: `otro.${correo}`, telefono: telefono(), aceptaTratamientoDatos: false } });
    expect(sinAutorizacion.status()).toBe(400);
    expect(Object.keys((await json(sinAutorizacion)).error.detalles.campos)).toEqual(['aceptaTratamientoDatos']);
  });

  test('CP-02: cinco contraseñas incorrectas → mensaje genérico y bloqueo de 15 minutos', { tag: '@CP-02' }, async ({ request }) => {
    const { correo } = await crearCuenta(request);
    const respuestas = [];
    for (let i = 0; i < 5; i += 1) {
      respuestas.push(await request.post('auth/sesion', { data: { identificador: correo, contrasena: 'equivocada1' } }));
    }
    const cuerpos = await Promise.all(respuestas.map(json));
    expect(respuestas.slice(0, 4).map((r) => r.status())).toEqual([401, 401, 401, 401]);
    expect(cuerpos[0].error.mensaje).toBe('Credenciales inválidas.');
    // El mensaje no revela si el correo existe: igual que con un correo inexistente.
    const inexistente = await json(await request.post('auth/sesion', { data: { identificador: 'nadie@agrotech.test', contrasena: 'equivocada1' } }));
    expect(inexistente.error.mensaje).toBe(cuerpos[0].error.mensaje);

    const bloqueado = await request.post('auth/sesion', { data: { identificador: correo, contrasena: CONTRASENA } });
    expect(bloqueado.status()).toBe(423);
    const { error } = await json(bloqueado);
    const minutos = (Date.parse(error.detalles.bloqueadoHasta) - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15.1);
    test.info().annotations.push({ type: 'medición', description: `Bloqueo de ${minutos.toFixed(1)} min tras el 5.º intento` });
  });

  test('RNF-04: cabeceras de seguridad, sin X-Powered-By y rutas protegidas exigen JWT', { tag: '@RNF-04' }, async ({ request }) => {
    const r = await request.get('salud');
    expect(r.headers()['x-content-type-options']).toBe('nosniff');
    expect(r.headers()['x-frame-options']).toBe('DENY');
    expect(r.headers()['x-powered-by']).toBeUndefined();
    expect((await request.get('pedidos')).status()).toBe(401);
    expect((await request.get('pedidos', { headers: { Authorization: 'Bearer token.falso.123' } })).status()).toBe(401);
  });
});
