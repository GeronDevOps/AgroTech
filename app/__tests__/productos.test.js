import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import 'expo-secure-store'; // inicializa el almacén simulado (global.__almacenSeguro)
import { establecerToken } from '../src/api/cliente';
import { apiFalsa, productoApi, sesionDe, usuarioAndres, usuarioRosa } from './apiFalsa';

const ID_FIJO = '11111111-1111-4111-8111-111111111111';
const vacio = { productos: [], pagina: 1, tamano: 20, total: 0, hayMas: false };
const pagina = (productos) => ({ productos, pagina: 1, tamano: 20, total: productos.length, hayMas: false });

beforeEach(() => {
  global.__almacenSeguro?.clear();
  establecerToken(null);
});

/** Abre la app con la sesión ya guardada en el teléfono (como al volver a abrirla). */
async function abrirComo(usuario, ruta, manejadores) {
  global.__almacenSeguro.set('agrotech.sesion', JSON.stringify(sesionDe(usuario)));
  const llamadas = apiFalsa({ 'GET /auth/yo': () => [200, { usuario }], ...manejadores });
  const render = renderRouter('./src/app', { initialUrl: '/' });
  await render;
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  // Con la sesión restaurada, se navega a la pantalla bajo prueba como lo haría el usuario.
  if (render.getPathname() !== ruta) await act(async () => router.push(ruta));
  await waitFor(() => expect(render.getPathname()).toBe(ruta));
  return { llamadas, getPathname: () => render.getPathname() };
}

const pulsar = (nombre) => fireEvent.press(screen.getByRole('button', { name: nombre }));
const datosEnviados = (llamadas) => llamadas.filter((l) => l.clave === 'POST /productos').map((l) => JSON.parse(l.cuerpo.datos));

async function llenarPublicacion() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Tomar foto' }));
  await waitFor(() => expect(screen.getByLabelText('Foto del producto')).toBeTruthy());
  await fireEvent.press(screen.getByRole('radio', { name: 'Papa' }));
  await fireEvent.changeText(screen.getByLabelText('Cantidad disponible'), '20');
  await fireEvent.changeText(screen.getByLabelText('Precio por bulto'), '85000');
}

describe('CU-02 · Publicar producto (AGRO-6)', () => {
  test('CP-03: con foto y datos publica y lleva a "Mis productos" con el aviso', async () => {
    const app = await abrirComo(usuarioRosa, '/productor/publicar', {
      'POST /productos': () => [201, { producto: productoApi({ id: ID_FIJO, nombre: 'Papa' }) }],
      'GET /productos/mios': () => [200, { productos: [productoApi({ id: ID_FIJO, nombre: 'Papa' })] }],
    });
    await llenarPublicacion();
    await pulsar('Publicar');

    await waitFor(() => expect(app.getPathname()).toBe('/productor/productos'));
    expect(await screen.findByTestId('aviso-publicado')).toHaveTextContent(/"Papa" quedó publicado/);
    expect(await screen.findByText('Activa')).toBeTruthy();

    expect(datosEnviados(app.llamadas)).toEqual([{
      id: ID_FIJO, nombre: 'Papa', categoria: 'TUBERCULOS', unidad: 'bulto', stock: 20, precio: 85000, municipio: 'Pamplonita',
    }]);
  });

  test('A2: sin foto no envía nada', async () => {
    const app = await abrirComo(usuarioRosa, '/productor/publicar', {});
    await fireEvent.press(await screen.findByRole('radio', { name: 'Papa' }));
    await fireEvent.changeText(screen.getByLabelText('Precio por bulto'), '85000');
    await pulsar('Publicar');
    expect(screen.getByText('Tome o elija una foto del producto.')).toBeTruthy();
    expect(datosEnviados(app.llamadas)).toHaveLength(0);
  });

  test('A3: si la señal se cae al enviar, queda en la cola y el reintento usa el mismo id (sin duplicar)', async () => {
    let intento = 0;
    const app = await abrirComo(usuarioRosa, '/productor/publicar', {
      'POST /productos': () => (++intento === 1 ? 'SIN_RED' : [201, { producto: productoApi({ id: ID_FIJO }) }]),
      'GET /productos/mios': () => [200, { productos: [productoApi({ id: ID_FIJO })] }],
    });
    await llenarPublicacion();
    await pulsar('Publicar');
    await waitFor(() => expect(app.getPathname()).toBe('/productor/productos'));
    expect(await screen.findByTestId('aviso-en-cola')).toHaveTextContent(/guardado en el teléfono/);

    // El motor de sincronización la reenvía sola con el mismo id.
    await waitFor(() => expect(datosEnviados(app.llamadas)).toHaveLength(2));
    const envios = datosEnviados(app.llamadas);
    expect(envios[0].id).toBe(ID_FIJO);
    expect(envios[1].id).toBe(ID_FIJO);
  });
});

describe('CU-10 · Precio y cantidad (AGRO-18)', () => {
  test('CP-13: cantidad 0 deja la publicación Agotada', async () => {
    const app = await abrirComo(usuarioRosa, '/productor/editar/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: productoApi() }],
      'PATCH /productos/p-papa': ({ cuerpo }) => [200, { producto: productoApi({ ...cuerpo, version: 2, estado: 'AGOTADA' }) }],
    });
    await fireEvent.changeText(await screen.findByLabelText('Cantidad disponible'), '0');
    await pulsar('Guardar cambios');
    expect(await screen.findByTestId('aviso-editar')).toHaveTextContent(/queda Agotada/);
    expect(app.llamadas.find((l) => l.clave === 'PATCH /productos/p-papa').cuerpo).toEqual({ precio: 85000, stock: 0, version: 1 });
  });

  test('CP-17: si otra edición ganó primero muestra los datos vigentes', async () => {
    await abrirComo(usuarioRosa, '/productor/editar/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: productoApi() }],
      'PATCH /productos/p-papa': () => [409, {
        error: { codigo: 'CONFLICTO_VERSION', mensaje: 'La publicación cambió mientras la editaba.', detalles: { producto: productoApi({ precio: 90000, version: 2 }) } },
      }],
    });
    await fireEvent.changeText(await screen.findByLabelText('Precio por bulto'), '70000');
    await pulsar('Guardar cambios');
    expect(await screen.findByTestId('aviso-editar')).toHaveTextContent(/cambió mientras la editaba/);
    expect(screen.getByLabelText('Precio por bulto').props.value).toBe('90000');
  });
});

describe('CU-03 · Catálogo con filtros (AGRO-7)', () => {
  test('CP-05: filtra por municipio y, sin resultados, ofrece limpiar los filtros (A1)', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor', {
      'GET /productos?pagina=1&tamano=20': () => [200, pagina([productoApi(), productoApi({ id: 'p-mora', nombre: 'Mora', categoria: 'FRUTAS', unidad: 'kg', precio: 4500 })])],
      'GET /productos?municipio=Oca%C3%B1a&pagina=1&tamano=20': () => [200, vacio],
    });
    expect(await screen.findByText('Papa pastusa')).toBeTruthy();
    expect(screen.getByText('2 productos')).toBeTruthy();

    await pulsar('Filtro Municipio');
    await fireEvent.changeText(screen.getByLabelText('Buscar en Municipio'), 'oca');
    await pulsar('Ocaña');
    expect(await screen.findByTestId('catalogo-vacio')).toHaveTextContent(/No hay productos con esos filtros/);
    expect(app.llamadas.map((l) => l.clave)).toContain('GET /productos?municipio=Oca%C3%B1a&pagina=1&tamano=20');

    await pulsar('Limpiar filtros');
    expect(await screen.findByText('Papa pastusa')).toBeTruthy();
  });

  test('filtra por categoría y por rango de precio', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor', {
      'GET /productos?pagina=1&tamano=20': () => [200, pagina([productoApi()])],
      'GET /productos?categoria=FRUTAS&pagina=1&tamano=20': () => [200, vacio],
      'GET /productos?categoria=FRUTAS&precioMin=1000&precioMax=5000&pagina=1&tamano=20': () => [200, vacio],
    });
    await screen.findByText('Papa pastusa');
    await pulsar('Filtro Categoría');
    await pulsar('Frutas');
    await waitFor(() => expect(app.llamadas.map((l) => l.clave)).toContain('GET /productos?categoria=FRUTAS&pagina=1&tamano=20'));
    await pulsar('Filtro Precio');
    await fireEvent.changeText(screen.getByLabelText('Desde ($)'), '1000');
    await fireEvent.changeText(screen.getByLabelText('Hasta ($)'), '5000');
    await pulsar('Aplicar');
    await waitFor(() => expect(app.llamadas.map((l) => l.clave)).toContain('GET /productos?categoria=FRUTAS&precioMin=1000&precioMax=5000&pagina=1&tamano=20'));
  });

  test('el detalle muestra productor y calificación; un producto agotado no se puede pedir (A3)', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor', {
      'GET /productos?pagina=1&tamano=20': () => [200, pagina([productoApi()])],
      'GET /productos/p-papa': () => [200, {
        producto: productoApi({ estado: 'AGOTADA', stock: 0, productor: { id: 'u-rosa', nombre: 'Rosa P.', verificado: true, calificacion: { promedio: 4.5, total: 2 } } }),
      }],
    });
    await fireEvent.press(await screen.findByLabelText(/^Papa pastusa, \$ 85\.000 por bulto/));
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/producto/p-papa'));
    expect(await screen.findByText('★ 4,5 (2)')).toBeTruthy();
    expect(screen.getByText('Rosa P. ✓ verificado')).toBeTruthy();
    expect(screen.getByTestId('aviso-agotado')).toBeTruthy();
  });

  test('A2: sin señal y sin copia en el teléfono lo informa en lugar de quedarse en blanco', async () => {
    await abrirComo(usuarioAndres, '/consumidor', { 'GET /productos?pagina=1&tamano=20': () => 'SIN_RED' });
    expect(await screen.findByTestId('aviso-sin-senal')).toHaveTextContent(/sincronizado nunca/);
    expect(await screen.findByText(/Aún no hay productos guardados en el teléfono/)).toBeTruthy();
  });
});
