'use strict';

const { createAuthService } = require('../../src/modules/auth/auth.service');

const politica = { intentosMaximos: 5, minutosBloqueo: 15, versionAvisoPrivacidad: '1.0' };

/** Hasher trivial: el "hash" es la contraseña con prefijo (no se prueba Bcrypt aquí). */
const hasher = { hash: async (c) => `h:${c}`, comparar: async (c, h) => h === `h:${c}` };
const tokens = { firmar: (u) => ({ token: `jwt-${u.id_usuario}`, tipo: 'Bearer', expiraEn: 'x' }) };

function usuarioBase(extra = {}) {
  return {
    id_usuario: 'u1', nombres: 'Rosa', apellidos: 'P', correo: 'rosa@correo.co', telefono: '3105551234',
    contrasena_hash: 'h:cosecha2026', rol: 'PRODUCTOR', municipio: 'Pamplonita', vereda_direccion: null,
    estado: 'ACTIVA', verificado: false, intentos_fallidos: 0, bloqueado_hasta: null, bloqueado: false, ...extra,
  };
}

function repoFalso(usuario) {
  const bitacora = [];
  const repo = {
    bitacora,
    crearCuenta: jest.fn(async (d) => usuarioBase({ ...d, contrasena_hash: d.contrasenaHash })),
    buscarPorCorreo: jest.fn(async () => usuario),
    buscarPorTelefono: jest.fn(async () => usuario),
    buscarPorId: jest.fn(async () => usuario),
    registrarIntentoFallido: jest.fn(async () => {
      usuario.intentos_fallidos += 1;
      if (usuario.intentos_fallidos >= politica.intentosMaximos) {
        usuario.intentos_fallidos = 0;
        usuario.bloqueado = true;
        usuario.bloqueado_hasta = 'hasta';
      }
      return { ...usuario };
    }),
    reiniciarIntentos: jest.fn(async () => {}),
    registrarBitacora: jest.fn(async (e) => { bitacora.push(`${e.accion}:${e.resultado}`); }),
  };
  return repo;
}

const servicio = (repo) => createAuthService({ authRepository: repo, hasher, tokens, politica });
const login = (svc, contrasena) => svc.iniciarSesion({ identificador: 'rosa@correo.co', contrasena });

describe('AuthService.iniciarSesion (CU-21)', () => {
  test('con credenciales correctas emite el token y no expone el hash', async () => {
    const repo = repoFalso(usuarioBase());
    const r = await login(servicio(repo), 'cosecha2026');
    expect(r.token).toBe('jwt-u1');
    expect(r.usuario).not.toHaveProperty('contrasena_hash');
    expect(repo.bitacora).toEqual(['INICIO_SESION:EXITOSO']);
  });

  test('CP-02: al quinto intento fallido bloquea y lo registra en bitácora', async () => {
    const repo = repoFalso(usuarioBase());
    const svc = servicio(repo);
    for (let i = 1; i <= 4; i += 1) {
      await expect(login(svc, 'mala1234')).rejects.toMatchObject({ status: 401, codigo: 'CREDENCIALES_INVALIDAS' });
    }
    await expect(login(svc, 'mala1234')).rejects.toMatchObject({ status: 423, codigo: 'CUENTA_BLOQUEADA' });
    expect(repo.bitacora).toContain('BLOQUEO_CUENTA:EXITOSO');
    // Bloqueada: ni la contraseña correcta abre la sesión
    await expect(login(svc, 'cosecha2026')).rejects.toMatchObject({ status: 423 });
  });

  test('usuario inexistente: mismo mensaje genérico y bitácora sin usuario', async () => {
    const repo = repoFalso(null);
    await expect(login(servicio(repo), 'lo-que-sea1')).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS', message: 'Credenciales inválidas.' });
    expect(repo.registrarBitacora).toHaveBeenCalledWith({ accion: 'INICIO_SESION', resultado: 'FALLIDO' });
  });

  test('cuenta suspendida solo se informa con la contraseña correcta (A2)', async () => {
    const svc = servicio(repoFalso(usuarioBase({ estado: 'SUSPENDIDA' })));
    await expect(login(svc, 'mala1234')).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' });
    await expect(login(svc, 'cosecha2026')).rejects.toMatchObject({ status: 403, codigo: 'CUENTA_SUSPENDIDA' });
  });

  test('un ingreso exitoso reinicia los intentos fallidos', async () => {
    const repo = repoFalso(usuarioBase({ intentos_fallidos: 3 }));
    await login(servicio(repo), 'cosecha2026');
    expect(repo.reiniciarIntentos).toHaveBeenCalledWith('u1');
  });
});

describe('AuthService.registrar (CU-01)', () => {
  const datos = {
    nombres: 'Andrés', apellidos: 'Contreras', correo: 'andres@correo.co', telefono: '3205550000',
    contrasena: 'mercado2026', rol: 'CONSUMIDOR', municipio: 'Cúcuta', aceptaTratamientoDatos: true,
  };

  test('guarda solo el hash y abre la sesión', async () => {
    const repo = repoFalso(null);
    const r = await servicio(repo).registrar(datos);
    expect(repo.crearCuenta.mock.calls[0][0]).toMatchObject({ contrasenaHash: 'h:mercado2026' });
    expect(repo.crearCuenta.mock.calls[0][1]).toEqual({ versionAviso: '1.0' });
    expect(r.token).toBeDefined();
  });

  test('correo duplicado → 409 CUENTA_EXISTENTE con el campo (A1)', async () => {
    const repo = repoFalso(null);
    repo.crearCuenta.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_usuario_telefono' }));
    await expect(servicio(repo).registrar(datos)).rejects.toMatchObject({ status: 409, codigo: 'CUENTA_EXISTENTE', detalles: { campo: 'telefono' } });
  });
});
