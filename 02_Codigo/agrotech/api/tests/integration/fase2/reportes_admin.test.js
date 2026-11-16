'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { migrate } = require('../../../src/db/migrate');
const config = require('../../../src/config/env');
const { entornoFase2, pool } = require('./comun');

const e = entornoFase2();
let rosa; let andres; let maria; let admin; let papa;
const reportar = (token, body) => e.post(token, '/reportes', body);

beforeAll(async () => { await migrate({ log: () => {} }); });
beforeEach(async () => {
  await pool.query('TRUNCATE usuario RESTART IDENTITY CASCADE');
  e.correo.enviados.length = 0;
  rosa = await e.cuenta('Rosa', 'PRODUCTOR', '3105551234');
  andres = await e.cuenta('Andres', 'CONSUMIDOR', '3205550000', 'Cúcuta');
  maria = await e.cuenta('Maria', 'CONSUMIDOR', '3005550000', 'Ocaña');
  admin = await e.administrador();
  papa = await e.producto(rosa.token, { nombre: 'Papa pastusa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20 });
});
afterAll(async () => {
  await fs.rm(config.fotos.dir, { recursive: true, force: true });
  await pool.end();
});

describe('CU-19 · Reportar contenido o incumplimiento (RF-19 · AGRO-28)', () => {
  test('CP-29: reporta una publicación; un reporte igual del mismo usuario se informa en trámite (A1)', async () => {
    const r = await reportar(andres.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'PRECIO_ABUSIVO', descripcion: 'El bulto está al doble que en la plaza' });
    expect(r.status).toBe(201);
    expect(r.body.reporte).toMatchObject({ estado: 'PENDIENTE', motivo: 'PRECIO_ABUSIVO', motivoTexto: 'Precio abusivo' });
    const otra = await reportar(andres.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'FRAUDE' });
    expect(otra.status).toBe(409);
    expect(otra.body.error.codigo).toBe('REPORTE_EN_TRAMITE');
    expect((await e.get(andres.token, '/reportes/mios')).body.reportes).toHaveLength(1);
    const { rows: [fila] } = await pool.query('SELECT id_reportado FROM reporte');
    expect(fila.id_reportado).toBe(rosa.id);
  });

  test('A2: con motivo «Otro» la descripción es obligatoria; no se reporta lo propio', async () => {
    const r = await reportar(andres.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'OTRO' });
    expect(r.status).toBe(400);
    expect(r.body.error.detalles.campos).toHaveProperty('descripcion');
    expect((await reportar(rosa.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'FRAUDE' })).body.error.codigo).toBe('REPORTE_PROPIO');
  });

  test('pedido entregado con incumplimiento: lo reporta una parte; un tercero no puede', async () => {
    const p = await e.pedido(andres.token, papa.id, 1);
    await e.entregar(rosa.token, p.id);
    expect((await reportar(maria.token, { tipoContenido: 'PEDIDO', idContenido: p.id, motivo: 'INCUMPLIMIENTO_ENTREGA' })).status).toBe(404);
    const r = await reportar(andres.token, { tipoContenido: 'PEDIDO', idContenido: p.id, motivo: 'INCUMPLIMIENTO_ENTREGA', descripcion: 'Llegaron 30 kg y no 50' });
    expect(r.status).toBe(201);
  });

  test('A3 sin señal: REPORTE.CREAR por /sync/push con el id del teléfono (idempotente)', async () => {
    const op = { idOperacion: crypto.randomUUID(), tipo: 'REPORTE.CREAR', idEntidad: crypto.randomUUID(), datos: { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'PUBLICACION_ENGANOSA' } };
    const r = await e.post(andres.token, '/sync/push', { operaciones: [op] });
    expect(r.body.resultados[0]).toMatchObject({ resultado: 'PUBLICADO', reporte: { id: op.idEntidad } });
    expect((await e.post(andres.token, '/sync/push', { operaciones: [op] })).body.resultados[0].resultado).toBe('YA_APLICADA');
  });
});

describe('CU-18 · Administrar y moderar (RF-18 · AGRO-29)', () => {
  test('A3: un usuario sin rol de administrador no entra al panel y el intento queda registrado', async () => {
    const r = await e.get(rosa.token, '/admin/resumen');
    expect(r.status).toBe(403);
    expect(await e.bitacora('ACCESO_DENEGADO')).toEqual([expect.objectContaining({ id_usuario: rosa.id, resultado: 'RECHAZADO' })]);
    expect((await e.get(admin.token, '/admin/resumen')).body).toMatchObject({ reportesAbiertos: 0, productoresPorVerificar: 1, productores: 1, consumidores: 2 });
  });

  test('CP-30: revisa el reporte con el historial del usuario y oculta la publicación; ambos reportantes reciben el resultado', async () => {
    await reportar(andres.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'PUBLICACION_ENGANOSA', descripcion: 'La foto no es de papa' });
    await reportar(maria.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'FRAUDE' });
    const lista = (await e.get(admin.token, '/admin/reportes')).body.reportes;
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({ reportesDelContenido: 2, reportado: 'Rosa Prueba' });

    const d = (await e.get(admin.token, `/admin/reportes/${lista[0].id}`)).body;
    expect(d.reporte.estado).toBe('EN_REVISION');
    expect(d.contenido).toMatchObject({ tipo: 'PRODUCTO', nombre: 'Papa pastusa' });
    expect(d.reportado.historial).toMatchObject({ reportesRecibidos: 2, pedidosCancelados: 0 });

    const r = await e.post(admin.token, `/admin/reportes/${lista[0].id}/resolver`, { decision: 'OCULTAR', resolucion: 'La foto no corresponde al producto.' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ reporte: { estado: 'RESUELTO', decision: 'OCULTAR' }, reportesCerrados: 2 });
    expect((await e.get(andres.token, `/productos/${papa.id}`)).status).toBe(404);
    for (const u of [andres, maria]) {
      await e.hasta(async () => (await e.get(u.token, '/notificaciones')).body.notificaciones.some((n) => n.tipo === 'REPORTE_RESUELTO'));
    }
    await e.hasta(async () => (await e.get(rosa.token, '/notificaciones')).body.notificaciones.some((n) => n.tipo === 'CONTENIDO_OCULTO'));
    expect((await e.bitacora('MODERACION_OCULTAR'))).toHaveLength(1);
    expect((await e.post(admin.token, `/admin/reportes/${lista[0].id}/resolver`, { decision: 'DESESTIMAR', resolucion: 'Otra vez' })).body.error.codigo).toBe('REPORTE_RESUELTO');
  });

  test('ocultar un comentario ofensivo conserva la puntuación', async () => {
    const p = await e.pedido(andres.token, papa.id, 1);
    await e.entregar(rosa.token, p.id);
    await e.post(andres.token, `/pedidos/${p.id}/calificacion`, { puntuacion: 1, comentario: 'Comentario ofensivo de prueba' });
    const opiniones = (await e.get(maria.token, `/productores/${rosa.id}/calificaciones`)).body.calificaciones;
    const rep = (await reportar(rosa.token, { tipoContenido: 'CALIFICACION', idContenido: opiniones[0].id, motivo: 'CONTENIDO_OFENSIVO' })).body.reporte;
    await e.post(admin.token, `/admin/reportes/${rep.id}/resolver`, { decision: 'OCULTAR', resolucion: 'Lenguaje ofensivo.' });
    const despues = (await e.get(maria.token, `/productores/${rosa.id}/calificaciones`)).body;
    expect(despues.calificaciones[0]).toMatchObject({ puntuacion: 1, comentario: null, oculto: true });
    expect(despues.reputacion).toEqual({ promedio: 1, total: 1 });
  });

  test('A1: reporte malintencionado → se desestima y se advierte al reportante', async () => {
    const rep = (await reportar(maria.token, { tipoContenido: 'PRODUCTO', idContenido: papa.id, motivo: 'OTRO', descripcion: 'No me cae bien la productora' })).body.reporte;
    const r = await e.post(admin.token, `/admin/reportes/${rep.id}/resolver`, { decision: 'DESESTIMAR', resolucion: 'El reporte no describe un incumplimiento.', malintencionado: true });
    expect(r.body.reporte.estado).toBe('DESESTIMADO');
    await e.hasta(async () => (await e.get(maria.token, '/notificaciones')).body.notificaciones.some((n) => n.tipo === 'ADVERTENCIA'));
    expect((await e.get(andres.token, `/productos/${papa.id}`)).status).toBe(200);
  });

  test('A2: suspender con pedidos en curso pide confirmación; al confirmar cancela los pedidos y cierra la sesión', async () => {
    const p = await e.pedido(andres.token, papa.id, 4);
    const sin = await e.post(admin.token, `/admin/usuarios/${rosa.id}/suspender`, { motivo: 'Fraude comprobado con la asociación' });
    expect(sin.status).toBe(409);
    expect(sin.body.error).toMatchObject({ codigo: 'REQUIERE_CONFIRMACION', detalles: { pedidosEnCurso: 1 } });

    const r = await e.post(admin.token, `/admin/usuarios/${rosa.id}/suspender`, { motivo: 'Fraude comprobado con la asociación', confirmar: true });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ usuario: { estado: 'SUSPENDIDA' }, pedidosCancelados: 1 });
    expect((await e.get(andres.token, `/pedidos/${p.id}`)).body.pedido).toMatchObject({ estado: 'CANCELADO', motivoCancelacion: 'Cuenta suspendida por la administración' });
    const yo = await e.get(rosa.token, '/auth/yo');
    expect(yo.status).toBe(401);
    expect(yo.body.error.mensaje).toMatch(/suspendida/);
    expect((await e.get(andres.token, '/productos')).body.productos).toEqual([]);
    expect(e.correo.enviados.some((c) => c.para === 'rosa@correo.co' && /suspendida/.test(c.asunto))).toBe(true);

    expect((await e.post(admin.token, `/admin/usuarios/${rosa.id}/reactivar`)).body.usuario.estado).toBe('ACTIVA');
    expect((await e.publico('post', '/auth/sesion', { identificador: 'rosa@correo.co', contrasena: 'cosecha2026' })).status).toBe(200);
  });

  test('paso 4: verifica al productor; buscar usuarios; supresiones y bitácora', async () => {
    const v = await e.post(admin.token, `/admin/usuarios/${rosa.id}/verificar`, { verificado: true });
    expect(v.body.usuario.verificado).toBe(true);
    expect((await e.get(andres.token, `/productos/${papa.id}`)).body.producto.productor.verificado).toBe(true);
    expect((await e.get(admin.token, '/admin/usuarios?q=rosa')).body.usuarios.map((u) => u.nombres)).toEqual(['Rosa']);
    expect((await e.get(admin.token, '/admin/usuarios?rol=consumidor')).body.usuarios).toHaveLength(2);
    expect((await e.get(admin.token, '/admin/supresiones')).body.solicitudes).toEqual([]);
    expect((await e.get(admin.token, '/admin/bitacora?limite=5')).body.registros[0]).toMatchObject({ accion: 'PRODUCTOR_VERIFICADO' });
  });
});
