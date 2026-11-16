'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { sumarDiasHabiles } = require('../../src/modules/privacidad/privacidad.service');
const { validarPerfil } = require('../../src/modules/perfil/perfil.validacion');
const { validarReporte } = require('../../src/modules/reportes/reportes.service');
const { validarFiltrosPedidos, validarCancelacion } = require('../../src/modules/pedidos/pedidos.validacion');
const { validarFiltros, validarCambioEstadoProducto } = require('../../src/modules/productos/productos.validacion');
const { validarRestablecimiento, validarSolicitudRecuperacion } = require('../../src/modules/auth/auth.validacion');
const { createCorreo } = require('../../src/modules/correo/correo');

const campos = (fn) => { try { fn(); } catch (e) { return e.detalles && e.detalles.campos; } return null; };
const uuid = '6f1b2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('Fase 2 · validaciones y utilidades', () => {
  test('CU-20: 15 días hábiles saltan sábados y domingos', () => {
    expect(sumarDiasHabiles(new Date('2026-11-13T12:00:00Z'), 15)).toBe('2026-12-04'); // viernes → viernes 3 semanas después
    expect(sumarDiasHabiles(new Date('2026-11-14T12:00:00Z'), 1)).toBe('2026-11-16'); // sábado → lunes
  });

  test('CU-09: perfil parcial normalizado; rol no editable; sin cambios → error', () => {
    expect(validarPerfil({ telefono: '+57 310 555 1234', municipio: 'ocana' })).toEqual({ telefono: '3105551234', municipio: 'Ocaña' });
    expect(() => validarPerfil({ rol: 'ADMINISTRADOR' })).toThrow(/rol no se puede cambiar/);
    expect(campos(() => validarPerfil({}))).toHaveProperty('cambios');
    expect(campos(() => validarPerfil({ ubicacion: { lat: 10.4, lon: -75.5 } }))).toHaveProperty('ubicacion');
  });

  test('CU-19: motivo de la lista; con «Otro» exige descripción', () => {
    expect(validarReporte({ tipoContenido: 'producto', idContenido: uuid, motivo: 'fraude' })).toMatchObject({ tipoContenido: 'PRODUCTO', motivo: 'FRAUDE' });
    expect(campos(() => validarReporte({ tipoContenido: 'MENSAJE', idContenido: 'x', motivo: 'NADA' }))).toEqual(expect.objectContaining({ tipoContenido: expect.any(String), idContenido: expect.any(String), motivo: expect.any(String) }));
    expect(campos(() => validarReporte({ tipoContenido: 'PEDIDO', idContenido: uuid, motivo: 'OTRO', descripcion: 'corto' }))).toHaveProperty('descripcion');
  });

  test('CU-15: filtros de pedidos por grupo, estados y fechas', () => {
    expect(validarFiltrosPedidos({})).toEqual({ estados: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO'], desde: null, hasta: null, pagina: 1 });
    expect(validarFiltrosPedidos({ estado: 'todos' }).estados).toBeNull();
    expect(validarFiltrosPedidos({ estado: 'entregado,cancelado' }).estados).toEqual(['ENTREGADO', 'CANCELADO']);
    expect(campos(() => validarFiltrosPedidos({ desde: '2026-10-10', hasta: '2026-10-01' }))).toHaveProperty('hasta');
    expect(campos(() => validarCancelacion({ motivo: 'no' }))).toHaveProperty('motivo');
  });

  test('CU-10 / CU-11 / CU-12: acciones de estado, búsqueda y cercanía', () => {
    expect(validarCambioEstadoProducto({ accion: 'pausar', version: '3' })).toEqual({ accion: 'PAUSAR', version: 3 });
    expect(campos(() => validarCambioEstadoProducto({ accion: 'BORRAR' }))).toEqual(expect.objectContaining({ accion: expect.any(String), version: expect.any(String) }));
    expect(validarFiltros({ q: ' Café%_ ', orden: 'PRECIO_ASC' })).toMatchObject({ q: 'Café', orden: 'precio_asc' });
    expect(validarFiltros({ lat: '7.3', lon: '-72.6', radioKm: '25' })).toMatchObject({ punto: { lat: 7.3, lon: -72.6 }, radioKm: 25 });
    expect(campos(() => validarFiltros({ radioKm: '0' }))).toHaveProperty('radioKm');
  });

  test('CU-08: correo y código de 6 dígitos; la contraseña sigue la política', () => {
    expect(validarSolicitudRecuperacion({ correo: ' Rosa@Correo.CO ' })).toEqual({ correo: 'rosa@correo.co' });
    expect(validarRestablecimiento({ correo: 'a@b.co', codigo: '123 456', contrasena: 'clave2026x' })).toMatchObject({ codigo: '123456' });
    expect(campos(() => validarRestablecimiento({ correo: 'a@b.co', codigo: '12345', contrasena: 'solo-letras' }))).toEqual(expect.objectContaining({ codigo: expect.any(String), contrasena: expect.any(String) }));
  });

  test('servicio de correo: drivers memoria y archivo', async () => {
    const memoria = createCorreo({ driver: 'memoria' });
    await memoria.enviar({ para: 'a@b.co', asunto: 'Hola', texto: 'Prueba' });
    expect(memoria.enviados).toEqual([expect.objectContaining({ para: 'a@b.co', asunto: 'Hola' })]);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'correo-'));
    const archivo = createCorreo({ driver: 'archivo', dir });
    await archivo.enviar({ para: 'a@b.co', asunto: 'Código', texto: '123456' });
    const [f] = await fs.readdir(dir);
    expect(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))).toMatchObject({ para: 'a@b.co', asunto: 'Código' });
    await fs.rm(dir, { recursive: true });
    expect(() => createCorreo({ driver: 'paloma' })).toThrow(/desconocido/);
  });
});
