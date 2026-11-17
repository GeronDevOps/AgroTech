// Banco de pruebas · Cuentas, recuperación, perfil y privacidad (BP-001 … BP-023)
const { bp, expect, medir } = require('./soporte');
const {
  auth, json, crearCuenta, publicar, pedir, entregar, codigoRecuperacion, registro, primerPedido, CONTRASENA, BUZON,
} = require('./comun');

const err = async (r) => (await json(r)).error;

bp('BP-001', async ({ request }) => {
  const r = await request.post('auth/registro', { data: registro({ rol: 'PRODUCTOR', municipio: 'Pamplonita' }) });
  expect(r.status()).toBe(201);
  const b = await json(r);
  expect(b).toMatchObject({ tipo: 'Bearer', usuario: { rol: 'PRODUCTOR', municipio: 'Pamplonita' } });
  const priv = await json(await request.get('privacidad', { headers: auth(b.token) }));
  expect(priv.autorizaciones).toEqual([expect.objectContaining({ version: priv.avisoVigente, canal: 'APP' })]);
});

bp('BP-002', async ({ request }) => {
  const datos = registro({ aceptaTratamientoDatos: false });
  const r = await request.post('auth/registro', { data: datos });
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.campos).toHaveProperty('aceptaTratamientoDatos');
  expect((await request.post('auth/sesion', { data: { identificador: datos.correo, contrasena: CONTRASENA } })).status()).toBe(401);
});

bp('BP-003', async ({ request }) => {
  const a = registro();
  expect((await request.post('auth/registro', { data: a })).status()).toBe(201);
  const r = await request.post('auth/registro', { data: registro({ correo: a.correo }) });
  expect(r.status()).toBe(409);
  expect(await err(r)).toMatchObject({ codigo: 'CUENTA_EXISTENTE', detalles: { campo: 'correo' } });
});

bp('BP-004', async ({ request }) => {
  for (const telefono of ['310555123', '31055512345', '2105551234']) {
    const r = await request.post('auth/registro', { data: registro({ telefono }) });
    expect(r.status(), telefono).toBe(400);
    expect((await err(r)).detalles.campos).toHaveProperty('telefono');
  }
});

bp('BP-005', async ({ request }) => {
  const r = await request.post('auth/registro', { data: registro({ rol: 'ADMINISTRADOR' }) });
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.campos).toHaveProperty('rol');
});

bp('BP-006', async ({ request }) => {
  for (const contrasena of ['abc1234', 'cosechaaa']) {
    const r = await request.post('auth/registro', { data: registro({ contrasena }) });
    expect(r.status(), contrasena).toBe(400);
    expect((await err(r)).detalles.campos).toHaveProperty('contrasena');
  }
  expect((await request.post('auth/registro', { data: registro({ contrasena: 'cosecha1' }) })).status()).toBe(201);
});

bp('BP-007', async ({ request }) => {
  const c = await crearCuenta(request);
  const porCorreo = await request.post('auth/sesion', { data: { identificador: c.correo.toUpperCase(), contrasena: CONTRASENA } });
  const porCelular = await request.post('auth/sesion', { data: { identificador: `${c.telefono.slice(0, 3)} ${c.telefono.slice(3, 6)} ${c.telefono.slice(6)}`, contrasena: CONTRASENA } });
  for (const r of [porCorreo, porCelular]) {
    expect(r.status()).toBe(200);
    expect((await request.get('auth/yo', { headers: auth((await json(r)).token) })).status()).toBe(200);
  }
});

bp('BP-008', async ({ request }) => {
  const c = await crearCuenta(request);
  const errada = await request.post('auth/sesion', { data: { identificador: c.correo, contrasena: 'otraClave99' } });
  const inexistente = await request.post('auth/sesion', { data: { identificador: 'nadie.bp@agrotech.test', contrasena: 'otraClave99' } });
  expect([errada.status(), inexistente.status()]).toEqual([401, 401]);
  const [a, b] = [await err(errada), await err(inexistente)];
  expect(a.codigo).toBe('CREDENCIALES_INVALIDAS');
  expect(a.mensaje).toBe(b.mensaje);
});

bp('BP-009', async ({ request }) => {
  const c = await crearCuenta(request);
  const fallar = () => request.post('auth/sesion', { data: { identificador: c.correo, contrasena: 'equivocada1' } });
  for (let i = 0; i < 4; i += 1) expect((await fallar()).status()).toBe(401);
  expect((await request.post('auth/sesion', { data: { identificador: c.correo, contrasena: CONTRASENA } })).status()).toBe(200); // 4 fallos: aún entra (y reinicia el contador)
  for (let i = 0; i < 4; i += 1) await fallar();
  const quinto = await fallar();
  expect(quinto.status()).toBe(423);
  const bloqueado = await request.post('auth/sesion', { data: { identificador: c.correo, contrasena: CONTRASENA } });
  expect(bloqueado.status()).toBe(423);
  const minutos = (Date.parse((await err(bloqueado)).detalles.bloqueadoHasta) - Date.now()) / 60000;
  expect(minutos).toBeGreaterThan(14);
  medir(`Bloqueo de ${minutos.toFixed(1)} min tras el 5.º intento fallido`);
});

bp('BP-010', async ({ request }) => {
  const c = await crearCuenta(request);
  const [cab, carga, firma] = c.token.split('.');
  const variantes = [{}, { Authorization: 'Bearer token.falso.123' }, { Authorization: `Bearer ${cab}.${carga}.${firma.slice(0, -3)}abc` }, { Authorization: c.token }];
  for (const h of variantes) {
    const r = await request.get('pedidos', { headers: h });
    expect(r.status()).toBe(401);
    expect((await err(r)).codigo).toBe('NO_AUTENTICADO');
  }
});

bp('BP-011', async ({ request }) => {
  const datos = registro();
  const respuestas = [await request.post('auth/registro', { data: datos })];
  respuestas.push(await request.post('auth/sesion', { data: { identificador: datos.correo, contrasena: CONTRASENA } }));
  const token = (await json(respuestas[1])).token;
  respuestas.push(await request.get('auth/yo', { headers: auth(token) }), await request.get('perfil', { headers: auth(token) }));
  for (const r of respuestas) {
    const texto = await r.text();
    expect(texto).not.toMatch(/contrasena|\$2[aby]\$/);
    expect(texto).not.toContain(CONTRASENA);
  }
});

bp('BP-012', async ({ request }) => {
  const c = await crearCuenta(request);
  const a = await request.post('auth/recuperar', { data: { correo: c.correo } });
  const b = await request.post('auth/recuperar', { data: { correo: 'no.existe.bp@agrotech.test' } });
  expect([a.status(), b.status()]).toEqual([202, 202]);
  expect((await json(a)).mensaje).toBe((await json(b)).mensaje);
});

bp('BP-013', async ({ request }) => {
  test_skip_sin_buzon();
  const c = await crearCuenta(request);
  const desde = Date.now() - 1000;
  await request.post('auth/recuperar', { data: { correo: c.correo } });
  const codigo = await codigoRecuperacion(c.correo, { desde });
  const malo = codigo === '000000' ? '111111' : '000000';
  const intento = (k) => request.post('auth/restablecer', { data: { correo: c.correo, codigo: k, contrasena: 'nuevaClave2026' } });
  expect((await err(await intento(malo))).detalles.intentosRestantes).toBe(2);
  expect((await err(await intento(malo))).detalles.intentosRestantes).toBe(1);
  expect((await err(await intento(malo))).codigo).toBe('CODIGO_AGOTADO');
  expect((await err(await intento(codigo))).codigo).toBe('CODIGO_INVALIDO');
});

bp('BP-014', async ({ request }) => {
  test_skip_sin_buzon();
  const c = await crearCuenta(request);
  const desde = Date.now() - 1000;
  await request.post('auth/recuperar', { data: { correo: c.correo } });
  const codigo = await codigoRecuperacion(c.correo, { desde });
  const ok = await request.post('auth/restablecer', { data: { correo: c.correo, codigo, contrasena: 'nuevaClave2026' } });
  expect(ok.status()).toBe(200);
  expect((await request.get('auth/yo', { headers: auth(c.token) })).status()).toBe(401);
  expect((await request.get('auth/yo', { headers: auth((await json(ok)).token) })).status()).toBe(200);
  expect((await err(await request.post('auth/restablecer', { data: { correo: c.correo, codigo, contrasena: 'otraClave2026' } }))).codigo).toBe('CODIGO_INVALIDO');
});

bp('BP-015', async ({ request }) => {
  for (const codigo of ['12345', '1234567', '12a456']) {
    const r = await request.post('auth/restablecer', { data: { correo: 'x.bp@agrotech.test', codigo, contrasena: 'nuevaClave2026' } });
    expect(r.status(), codigo).toBe(400);
    expect((await err(r)).detalles.campos).toHaveProperty('codigo');
  }
});

bp('BP-016', async ({ request }) => {
  const c = await crearCuenta(request, { municipio: 'Cúcuta' });
  const r = await request.patch('perfil', { headers: auth(c.token), data: { municipio: 'ocana' } });
  expect(r.status()).toBe(200);
  const { perfil } = await json(r);
  expect(perfil).toMatchObject({ municipio: 'Ocaña', ubicacion: { origen: 'MUNICIPIO' } });
  expect(perfil.ubicacion.lat).toBeCloseTo(8.24, 1);
});

bp('BP-017', async ({ request }) => {
  const c = await crearCuenta(request);
  const fuera = await request.patch('perfil', { headers: auth(c.token), data: { ubicacion: { lat: 4.6, lon: -74.08 } } });
  expect(fuera.status()).toBe(400);
  expect((await err(fuera)).detalles.campos).toHaveProperty('ubicacion');
  const dentro = await json(await request.patch('perfil', { headers: auth(c.token), data: { ubicacion: { lat: 7.5, lon: -72.6 } } }));
  expect(dentro.perfil.ubicacion).toEqual({ lat: 7.5, lon: -72.6, origen: 'TELEFONO' });
});

bp('BP-018', async ({ request }) => {
  const c = await crearCuenta(request);
  const r = await request.patch('perfil', { headers: auth(c.token), data: { rol: 'PRODUCTOR' } });
  expect(r.status()).toBe(409);
  expect((await err(r)).codigo).toBe('ROL_NO_EDITABLE');
  expect((await json(await request.get('perfil', { headers: auth(c.token) }))).perfil.rol).toBe('CONSUMIDOR');
});

bp('BP-019', async ({ request }) => {
  const a = await crearCuenta(request);
  const b = await crearCuenta(request);
  const r = await request.patch('perfil', { headers: auth(a.token), data: { correo: b.correo } });
  expect(r.status()).toBe(409);
  expect(await err(r)).toMatchObject({ codigo: 'DATO_EN_USO', detalles: { campo: 'correo' } });
});

bp('BP-020', async ({ request }) => {
  const c = await crearCuenta(request);
  const p = await json(await request.get('privacidad', { headers: auth(c.token) }));
  expect(p.datos).toMatchObject({ correo: c.correo, telefono: c.telefono });
  expect(p.finalidades.length).toBeGreaterThanOrEqual(4);
  expect(p.autorizaciones[0]).toMatchObject({ canal: 'APP' });
  expect(p.supresion).toMatchObject({ solicitud: null, plazoDiasHabiles: 15 });
});

bp('BP-021', async ({ request }) => {
  const c = await crearCuenta(request);
  const r = await request.post('privacidad/supresion', { headers: auth(c.token), data: {} });
  expect(r.status()).toBe(400);
  expect((await err(r)).detalles.consecuencias.length).toBeGreaterThan(3);
  expect((await request.get('auth/yo', { headers: auth(c.token) })).status()).toBe(200);
});

bp('BP-022', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const c = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  await primerPedido(await pedir(request, c.token, [{ idProducto: papa.id, cantidad: 1 }]));
  const h = { headers: auth(c.token) };
  const a = await request.post('privacidad/supresion', { ...h, data: { confirmar: true } });
  expect(a.status()).toBe(202);
  expect((await json(a)).solicitud.estado).toBe('APLAZADA');
  expect((await err(await request.post('privacidad/supresion', { ...h, data: { confirmar: true } }))).codigo).toBe('SOLICITUD_EN_TRAMITE');
  expect((await json(await request.delete('privacidad/supresion', h))).solicitud.estado).toBe('DESISTIDA');
  expect((await request.get('auth/yo', h)).status()).toBe(200);
});

bp('BP-023', async ({ request }) => {
  const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
  const c = await crearCuenta(request);
  const papa = await publicar(request, rosa.token);
  const p = await entregar(request, rosa.token, await primerPedido(await pedir(request, c.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const r = await request.post('privacidad/supresion', { headers: auth(c.token), data: { confirmar: true } });
  expect(r.status()).toBe(200);
  expect((await json(r)).solicitud.estado).toBe('COMPLETADA');
  expect((await request.get('auth/yo', { headers: auth(c.token) })).status()).toBe(401);
  expect((await request.post('auth/sesion', { data: { identificador: c.correo, contrasena: CONTRASENA } })).status()).toBe(401);
  const visto = (await json(await request.get(`pedidos/${p.id}`, { headers: auth(rosa.token) }))).pedido;
  expect(visto).toMatchObject({ estado: 'ENTREGADO', puntoEntrega: 'Dato suprimido', consumidor: { nombre: 'Usuario A.' } });
});

function test_skip_sin_buzon() {
  require('@playwright/test').test.skip(!BUZON, 'Requiere el buzón de correo de la API local.');
}
