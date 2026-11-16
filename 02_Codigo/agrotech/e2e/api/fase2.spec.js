// Fase 2 del SRS (v1.1.0) · Pruebas de sistema de caja negra sobre la API REST y el WebSocket
// CU-08 recuperar · CU-09 perfil · CU-10 pausar/retirar · CU-11 buscar · CU-12 cercanía · CU-14 cancelar
// CU-15 historial · CU-16 avisos · CU-18 moderación · CU-19 reportar · CU-20 datos personales
const crypto = require('node:crypto');
const { test, expect } = require('@playwright/test');
const {
  auth, uuid, json, crearCuenta, publicar, pedir, entregar, aceptar, conectarWs, codigoRecuperacion, entrarAdmin, BUZON, CONTRASENA,
} = require('../soporte/api');

const marca = () => crypto.randomBytes(3).toString('hex');
const esperarHasta = async (condicion, ms = 5000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await condicion()) return; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('Tiempo agotado esperando la condición');
};
const primerPedido = async (r) => { expect(r.status(), await r.text()).toBe(201); return (await json(r)).pedidos[0]; };

test.describe('CU-08 · Recuperar la contraseña', () => {
  test('CP-20: código por correo de un solo uso; errado, débil y sesiones anteriores cerradas', { tag: '@CP-20' }, async ({ request }) => {
    test.skip(!BUZON, 'Requiere el buzón de correo de la API local (driver "archivo").');
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const neutro = await json(await request.post('auth/recuperar', { data: { correo: 'nadie.existe@agrotech.test' } }));
    const desde = Date.now() - 1000;
    const r = await request.post('auth/recuperar', { data: { correo: rosa.correo.toUpperCase() } });
    expect(r.status()).toBe(202);
    expect((await json(r)).mensaje).toBe(neutro.mensaje); // A1: mismo mensaje exista o no la cuenta
    const codigo = await codigoRecuperacion(rosa.correo, { desde });

    const otro = codigo === '000000' ? '111111' : '000000';
    const errado = await request.post('auth/restablecer', { data: { correo: rosa.correo, codigo: otro, contrasena: 'nuevaClave2026' } });
    expect((await json(errado)).error).toMatchObject({ codigo: 'CODIGO_INCORRECTO', detalles: { intentosRestantes: 2 } });
    const debil = await request.post('auth/restablecer', { data: { correo: rosa.correo, codigo, contrasena: 'solo' } });
    expect(debil.status()).toBe(400);
    expect((await json(debil)).error.detalles.campos.contrasena).toMatch(/letras y números/);

    const ok = await request.post('auth/restablecer', { data: { correo: rosa.correo, codigo, contrasena: 'nuevaClave2026' } });
    expect(ok.status()).toBe(200);
    const sesionNueva = await json(ok);
    expect((await request.get('auth/yo', { headers: auth(rosa.token) })).status()).toBe(401); // sesión vieja cerrada
    expect((await request.get('auth/yo', { headers: auth(sesionNueva.token) })).status()).toBe(200);
    expect((await request.post('auth/sesion', { data: { identificador: rosa.correo, contrasena: CONTRASENA } })).status()).toBe(401);
    const reuso = await request.post('auth/restablecer', { data: { correo: rosa.correo, codigo, contrasena: 'otraClave2026' } });
    expect((await json(reuso)).error.codigo).toBe('CODIGO_INVALIDO');
  });
});

test.describe('CU-09 / CU-20 · Perfil y datos personales', () => {
  test('CP-21: actualiza contacto y ubicación; celular en uso y cambio de rol se rechazan', { tag: '@CP-21' }, async ({ request }) => {
    const andres = await crearCuenta(request, { municipio: 'Cúcuta' });
    const otra = await crearCuenta(request);
    const h = { headers: auth(andres.token) };
    const r = await request.patch('perfil', { ...h, data: { municipio: 'Pamplona', veredaDireccion: 'Barrio El Carmen' } });
    expect(r.status()).toBe(200);
    const { perfil } = await json(r);
    expect(perfil).toMatchObject({ municipio: 'Pamplona', ubicacion: { origen: 'MUNICIPIO' } });
    expect(perfil.ubicacion.lat).toBeCloseTo(7.3756, 2);
    const gps = await json(await request.patch('perfil', { ...h, data: { ubicacion: { lat: 7.38, lon: -72.65 } } }));
    expect(gps.perfil.ubicacion).toEqual({ lat: 7.38, lon: -72.65, origen: 'TELEFONO' });
    const enUso = await request.patch('perfil', { ...h, data: { telefono: otra.telefono } });
    expect(enUso.status()).toBe(409);
    expect((await json(enUso)).error).toMatchObject({ codigo: 'DATO_EN_USO', detalles: { campo: 'telefono' } });
    expect((await json(await request.patch('perfil', { ...h, data: { rol: 'PRODUCTOR' } }))).error.codigo).toBe('ROL_NO_EDITABLE');
  });

  test('CP-22: supresión aplazada con pedidos en curso; sin ellos anonimiza y conserva la transacción', { tag: '@CP-22' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token, { stock: 10 });
    const pedido = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
    const h = { headers: auth(andres.token) };

    const consulta = await json(await request.get('privacidad', h));
    expect(consulta.datos.correo).toBe(andres.correo);
    expect(consulta.autorizaciones[0]).toMatchObject({ version: expect.any(String), canal: 'APP' });

    const aplazada = await request.post('privacidad/supresion', { ...h, data: { confirmar: true } });
    expect(aplazada.status()).toBe(202);
    expect((await json(aplazada)).solicitud.estado).toBe('APLAZADA');
    expect((await json(await request.delete('privacidad/supresion', h))).solicitud.estado).toBe('DESISTIDA');

    await entregar(request, rosa.token, pedido);
    const r = await request.post('privacidad/supresion', { ...h, data: { confirmar: true, motivo: 'Prueba de sistema' } });
    expect(r.status()).toBe(200);
    expect(await json(r)).toMatchObject({ sesionCerrada: true, solicitud: { estado: 'COMPLETADA' } });
    expect((await request.get('auth/yo', h)).status()).toBe(401);
    expect((await request.post('auth/sesion', { data: { identificador: andres.correo, contrasena: CONTRASENA } })).status()).toBe(401);
    // El productor conserva el pedido, sin la identificación del consumidor.
    const visto = (await json(await request.get(`pedidos/${pedido.id}`, { headers: auth(rosa.token) }))).pedido;
    expect(visto).toMatchObject({ estado: 'ENTREGADO', puntoEntrega: 'Dato suprimido', consumidor: { nombre: 'Usuario A.' } });
  });
});

test.describe('CU-10 / CU-11 / CU-12 · Publicaciones, búsqueda y cercanía', () => {
  test('CP-23: pausar oculta; retirar con pedido en curso se bloquea; retirar conserva el histórico', { tag: '@CP-23' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const nombre = `Mora ${marca()}`;
    let mora = await publicar(request, rosa.token, { nombre, categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 5 }, 'platano');
    const estado = (accion, version) => request.patch(`productos/${mora.id}/estado`, { headers: auth(rosa.token), data: { accion, version } });
    const buscar = async () => (await json(await request.get(`productos?q=${encodeURIComponent(nombre)}`, { headers: auth(andres.token) }))).productos;

    mora = (await json(await estado('PAUSAR', mora.version))).producto;
    expect(mora.estado).toBe('PAUSADA');
    expect(await buscar()).toEqual([]);
    mora = (await json(await estado('REACTIVAR', mora.version))).producto;
    expect((await buscar()).map((p) => p.id)).toEqual([mora.id]);

    const pedido = await primerPedido(await pedir(request, andres.token, [{ idProducto: mora.id, cantidad: 1 }]));
    mora = (await json(await request.get(`productos/${mora.id}`, { headers: auth(rosa.token) }))).producto;
    const bloqueado = await estado('RETIRAR', mora.version);
    expect(bloqueado.status()).toBe(409);
    expect((await json(bloqueado)).error.codigo).toBe('PEDIDOS_EN_CURSO');
    await entregar(request, rosa.token, pedido);
    mora = (await json(await request.get(`productos/${mora.id}`, { headers: auth(rosa.token) }))).producto;
    expect((await json(await estado('RETIRAR', mora.version))).producto.estado).toBe('INACTIVA');
    expect((await json(await request.get(`pedidos/${pedido.id}`, { headers: auth(andres.token) }))).pedido.items[0].nombre).toBe(nombre);
  });

  test('CP-24: búsqueda sin tildes en nombre y descripción, orden por precio y sugerencias', { tag: '@CP-24' }, async ({ request }) => {
    const m = marca();
    const luis = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
    await publicar(request, luis.token, { nombre: `Café ${m} especial`, categoria: 'CAFE_CACAO', unidad: 'kg', precio: 22000, stock: 10, municipio: 'Ocaña' });
    await publicar(request, luis.token, { nombre: `Cebolla ocañera ${m}`, descripcion: `Para acompañar el CAFÉ ${m}`, categoria: 'HORTALIZAS', unidad: 'kg', precio: 2500, stock: 10, municipio: 'Ocaña' }, 'cebolla');
    const andres = await crearCuenta(request);
    const q = async (params) => json(await request.get(`productos?${new URLSearchParams(params)}`, { headers: auth(andres.token) }));
    const t0 = performance.now();
    const cafe = await q({ q: `cafe ${m}`, orden: 'precio_asc' });
    test.info().annotations.push({ type: 'medición', description: `Búsqueda «cafe» respondió en ${Math.round(performance.now() - t0)} ms` });
    const mios = cafe.productos.map((p) => p.nombre);
    expect(mios).toEqual([`Cebolla ocañera ${m}`, `Café ${m} especial`]); // descripción con tilde y mayúsculas; precio ascendente
    expect((await q({ q: `ocanera ${m}` })).productos.map((p) => p.nombre)).toEqual([`Cebolla ocañera ${m}`]);
    const nada = await q({ q: `zzz${m}` });
    expect(nada.total).toBe(0);
    expect(nada.sugerencias.length).toBeGreaterThan(0);
  });

  test('CP-25: «Cerca de mí» ordena por distancia con el GPS o el perfil y respeta el radio', { tag: '@CP-25' }, async ({ request }) => {
    const m = marca();
    const ocana = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
    const pamplona = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Pamplona' });
    await publicar(request, ocana.token, { nombre: `Tomate ${m} Ocaña`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Ocaña' }, 'cebolla');
    await publicar(request, pamplona.token, { nombre: `Tomate ${m} Pamplona`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Pamplona' }, 'cebolla');
    const andres = await crearCuenta(request, { municipio: 'Pamplonita' });
    const q = async (params) => json(await request.get(`productos?${new URLSearchParams({ q: `tomate ${m}`, orden: 'cercania', ...params })}`, { headers: auth(andres.token) }));

    const perfil = await q({});
    expect(perfil.ubicacion).toMatchObject({ origen: 'PERFIL', municipio: 'Pamplonita' });
    expect(perfil.productos.map((p) => p.municipio)).toEqual(['Pamplona', 'Ocaña']);
    const gps = await q({ lat: 8.24, lon: -73.35 });
    expect(gps.productos.map((p) => p.municipio)).toEqual(['Ocaña', 'Pamplona']);
    expect(gps.productos[0].distanciaKm).toBeLessThan(gps.productos[1].distanciaKm);
    test.info().annotations.push({ type: 'medición', description: `Distancias desde Ocaña: ${gps.productos.map((p) => `${p.municipio} ${p.distanciaKm} km`).join(' · ')}` });
    expect((await q({ lat: 8.24, lon: -73.35, radioKm: 20 })).productos.map((p) => p.municipio)).toEqual(['Ocaña']);
    const vacio = await q({ lat: 6.95, lon: -72.1, radioKm: 5 });
    expect(vacio).toMatchObject({ total: 0, ampliarRadio: { radioActualKm: 5, sugeridoKm: 10 } });
  });
});

test.describe('CU-14 / CU-15 / CU-16 · Cancelación, historial y avisos', () => {
  test('CP-26: cancelar un pedido aceptado restituye el inventario una vez; el entregado no se cancela', { tag: '@CP-26' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token, { stock: 20 });
    const stock = async () => (await json(await request.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto.stock;

    let p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 4 }]));
    p = await aceptar(request, rosa.token, p);
    expect(await stock()).toBe(16);
    // A2: ambas partes cancelan a la vez → prevalece una.
    const [a, b] = await Promise.all([
      request.post(`pedidos/${p.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Ya no lo necesito' } }),
      request.post(`pedidos/${p.id}/cancelar`, { headers: auth(rosa.token), data: { motivo: 'No tengo el producto' } }),
    ]);
    expect([a.status(), b.status()].sort()).toEqual([200, 409]);
    expect(await stock()).toBe(20);
    const detalle = (await json(await request.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido;
    expect(detalle.historial.map((h) => h.estadoNuevo)).toEqual(['PENDIENTE', 'ACEPTADO', 'CANCELADO']);
    expect(detalle.motivoCancelacion).toMatch(/^(Consumidor|Productor): /);
    const chat = await request.post(`pedidos/${p.id}/mensajes`, { headers: auth(andres.token), data: { id: uuid(), contenido: 'Hola' } });
    expect((await json(chat)).error.codigo).toBe('CHAT_CERRADO');

    const entregado = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
    const r = await request.post(`pedidos/${entregado.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Tarde' } });
    expect((await json(r)).error.codigo).toBe('PEDIDO_ENTREGADO');
  });

  test('CP-27: historial con filtros de estado y fechas, del más reciente al más antiguo', { tag: '@CP-27' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token, { stock: 20 });
    const p1 = await entregar(request, rosa.token, await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
    const p2 = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 2 }]));
    await request.post(`pedidos/${p2.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Me equivoqué' } });
    const p3 = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 3 }]));
    const ids = async (q) => (await json(await request.get(`pedidos?${new URLSearchParams(q)}`, { headers: auth(andres.token) }))).pedidos.map((x) => x.id);
    expect(await ids({})).toEqual([p3.id]);
    expect(await ids({ estado: 'finalizados' })).toEqual([p2.id, p1.id]);
    expect(await ids({ estado: 'todos' })).toEqual([p3.id, p2.id, p1.id]);
    const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    expect(await ids({ estado: 'todos', desde: hoy, hasta: hoy })).toEqual([p3.id, p2.id, p1.id]);
    expect(await ids({ estado: 'todos', hasta: '2026-01-01' })).toEqual([]);
    expect((await json(await request.get(`pedidos/${p3.id}`, { headers: auth(andres.token) }))).pedido.acciones).toEqual(['CHAT', 'CANCELAR', 'REPORTAR']);
  });

  test('CP-28: aceptar, escribir y cancelar llegan en tiempo real y quedan en la bandeja', { tag: '@CP-28' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR', nombres: 'Rosa' });
    const andres = await crearCuenta(request, { nombres: 'Andres' });
    const papa = await publicar(request, rosa.token, { stock: 20 });
    const p = await primerPedido(await pedir(request, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
    const ws = await conectarWs(andres.token);
    const wsRosa = await conectarWs(rosa.token);
    try {
      const t0 = Date.now();
      await aceptar(request, rosa.token, p);
      await request.post(`pedidos/${p.id}/mensajes`, { headers: auth(rosa.token), data: { id: uuid(), contenido: 'Mañana a las 9' } });
      await request.post(`pedidos/${p.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Ya compré en la plaza' } });
      const tipos = (w) => w.recibidos.filter((m) => m.tipo === 'notificacion').map((m) => m.notificacion.tipo);
      await esperarHasta(() => tipos(ws).includes('PEDIDO_ACEPTADO') && tipos(ws).includes('MENSAJE') && tipos(wsRosa).includes('PEDIDO_CANCELADO'));
      const ultimo = Math.max(...[...ws.recibidos, ...wsRosa.recibidos].filter((m) => m.tipo === 'notificacion').map((m) => m.recibidoEn));
      test.info().annotations.push({ type: 'medición', description: `Tres avisos entregados por WebSocket en ${ultimo - t0} ms` });
    } finally { ws.close(); wsRosa.close(); }
    const bandeja = await json(await request.get('notificaciones', { headers: auth(andres.token) }));
    expect(bandeja.sinLeer).toBe(2);
    expect(bandeja.notificaciones.find((n) => n.tipo === 'MENSAJE').datos).toEqual({ idPedido: p.id, abrir: 'CHAT' });
    await request.post('notificaciones/leidas', { headers: auth(andres.token) });
    expect((await json(await request.get('notificaciones', { headers: auth(andres.token) }))).sinLeer).toBe(0);
  });
});

test.describe('CU-19 / CU-18 · Reportes y moderación', () => {
  test('CP-29: reportar una publicación; el repetido está en trámite y «Otro» exige descripción', { tag: '@CP-29' }, async ({ request }) => {
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token);
    const h = { headers: auth(andres.token) };
    const r = await request.post('reportes', { ...h, data: { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'PRECIO_ABUSIVO', descripcion: 'Doble del precio de la plaza' } });
    expect(r.status()).toBe(201);
    expect((await json(r)).reporte).toMatchObject({ estado: 'PENDIENTE', motivoTexto: 'Precio abusivo' });
    expect((await json(await request.post('reportes', { ...h, data: { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'FRAUDE' } }))).error.codigo).toBe('REPORTE_EN_TRAMITE');
    const otro = await request.post('reportes', { headers: auth(rosa.token), data: { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'OTRO' } });
    expect(otro.status()).toBe(400);
    expect((await json(await request.get('reportes/mios', h))).reportes).toHaveLength(1);
  });

  test('CP-30: el administrador oculta lo reportado y suspende con confirmación; un no administrador no entra', { tag: '@CP-30' }, async ({ request }) => {
    const admin = await entrarAdmin(request);
    const rosa = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const andres = await crearCuenta(request);
    const papa = await publicar(request, rosa.token);
    expect((await request.get('admin/resumen', { headers: auth(rosa.token) })).status()).toBe(403);

    const { reporte } = await json(await request.post('reportes', { headers: auth(andres.token), data: { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'PUBLICACION_ENGANOSA', descripcion: 'La foto no es del producto' } }));
    const ha = { headers: auth(admin.token) };
    const revision = await json(await request.get(`admin/reportes/${reporte.id}`, ha));
    expect(revision).toMatchObject({ reporte: { estado: 'EN_REVISION' }, contenido: { id: papa.id }, reportado: { id: rosa.usuario.id } });
    const res = await json(await request.post(`admin/reportes/${reporte.id}/resolver`, { ...ha, data: { decision: 'OCULTAR', resolucion: 'La foto no corresponde al producto.' } }));
    expect(res.reporte).toMatchObject({ estado: 'RESUELTO', decision: 'OCULTAR' });
    expect((await request.get(`productos/${papa.id}`, { headers: auth(andres.token) })).status()).toBe(404);
    await esperarHasta(async () => (await json(await request.get('notificaciones', { headers: auth(andres.token) }))).notificaciones.some((n) => n.tipo === 'REPORTE_RESUELTO'));

    const otra = await publicar(request, rosa.token, { nombre: 'Papa sabanera' });
    await primerPedido(await pedir(request, andres.token, [{ idProducto: otra.id, cantidad: 1 }]));
    const sin = await request.post(`admin/usuarios/${rosa.usuario.id}/suspender`, { ...ha, data: { motivo: 'Publicaciones engañosas repetidas' } });
    expect((await json(sin)).error).toMatchObject({ codigo: 'REQUIERE_CONFIRMACION', detalles: { pedidosEnCurso: 1 } });
    const con = await json(await request.post(`admin/usuarios/${rosa.usuario.id}/suspender`, { ...ha, data: { motivo: 'Publicaciones engañosas repetidas', confirmar: true } }));
    expect(con).toMatchObject({ usuario: { estado: 'SUSPENDIDA' }, pedidosCancelados: 1 });
    expect((await request.get('auth/yo', { headers: auth(rosa.token) })).status()).toBe(401);
    const bitacora = (await json(await request.get('admin/bitacora?limite=20', ha))).registros.map((b) => b.accion);
    expect(bitacora).toEqual(expect.arrayContaining(['CUENTA_SUSPENDIDA', 'MODERACION_OCULTAR', 'ACCESO_DENEGADO']));
    expect((await json(await request.post(`admin/usuarios/${rosa.usuario.id}/reactivar`, ha))).usuario.estado).toBe('ACTIVA');
  });
});
