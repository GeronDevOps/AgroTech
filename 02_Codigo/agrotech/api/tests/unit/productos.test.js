'use strict';

const { validarFiltros, validarEdicion, validarPublicacion } = require('../../src/modules/productos/productos.validacion');
const { createProductosService } = require('../../src/modules/productos/productos.service');

const campos = (fn) => {
  try { fn(); } catch (e) { return e.detalles.campos; }
  throw new Error('se esperaba error de validación');
};

describe('validación de productos', () => {
  test('filtros: normaliza municipio y aplica valores por defecto', () => {
    expect(validarFiltros({ municipio: 'cucuta', categoria: 'frutas' })).toEqual({
      municipio: 'Cúcuta', categoria: 'FRUTAS', pagina: 1, tamano: 20, orden: 'recientes',
    });
    expect(campos(() => validarFiltros({ tamano: '80', pagina: '0' }))).toEqual(expect.objectContaining({ tamano: expect.any(String), pagina: expect.any(String) }));
  });

  test('edición: acepta cantidad 0 (Agotada) y exige versión', () => {
    expect(validarEdicion({ stock: '0', version: '3' })).toEqual({ stock: 0, version: 3 });
    expect(campos(() => validarEdicion({ precio: 1000 }))).toHaveProperty('version');
    expect(campos(() => validarEdicion({ stock: 1.234, version: 1 }))).toHaveProperty('stock');
  });

  test('publicación: precio entero en pesos y cantidad mayor que 0', () => {
    const d = validarPublicacion({ nombre: ' Papa ', categoria: 'tuberculos', unidad: 'BULTO', precio: '85000', stock: '2.5', municipio: 'pamplonita' });
    expect(d).toMatchObject({ nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 2.5, municipio: 'Pamplonita' });
  });
});

describe('ProductosService.publicar', () => {
  const datos = { nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', precio: 85000, stock: 20, municipio: 'Pamplonita' };
  const jpeg = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) };
  const limites = { maxBytes: 1000, maxBytesMiniatura: 100 };

  test('si la inserción falla borra las fotos guardadas (A3: se puede reintentar sin basura)', async () => {
    const almacen = { guardar: jest.fn(), eliminar: jest.fn(), urlPublica: (c) => c };
    const repo = {
      buscarPorId: jest.fn(async () => null),
      insertar: jest.fn(async () => { throw new Error('caída de la base de datos'); }),
    };
    const svc = createProductosService({ productosRepository: repo, almacenFotos: almacen, limitesFotos: limites });
    await expect(svc.publicar({ usuario: { id: 'u1' }, datos, archivos: { foto: jpeg, miniatura: jpeg }, baseFotos: '' }))
      .rejects.toThrow('caída');
    expect(almacen.guardar).toHaveBeenCalledTimes(2);
    expect(almacen.eliminar).toHaveBeenCalledTimes(2);
    expect(almacen.eliminar.mock.calls[1][0]).toMatch(/_min\.jpg$/);
  });
});
