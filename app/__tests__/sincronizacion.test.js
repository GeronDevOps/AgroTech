import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import 'expo-secure-store'; // inicializa el almacén simulado (global.__almacenSeguro)
import { establecerToken } from '../src/api/cliente';
import { catalogoLocal, pedidosLocal } from '../src/local/cache';
import { leerMeta } from '../src/local/baseLocal';
import { encolarEdicion, encolarPublicacion, marcarEnviando, operacionesEnCola, quitarPublicada } from '../src/local/cola';
import { sincronizarAhora } from '../src/sync/motor';
import { apiFalsa, productoApi, sesionDe, usuarioAndres, usuarioRosa } from './apiFalsa';

const ID_FIJO = '11111111-1111-4111-8111-111111111111';
const AHORA = '2026-10-11T15:00:00.000Z';
const pull = (productos = [], extra = {}) => ({
  servidorEn: AHORA, completa: true, productos, hayMas: false, siguiente: null, retirados: [], pedidos: [], ...extra,
});

beforeEach(() => {
  global.__almacenSeguro?.clear();
  establecerToken(null);
});

async function abrirComo(usuario, ruta, manejadores) {
  global.__almacenSeguro.set('agrotech.sesion', JSON.stringify(sesionDe(usuario)));
  const llamadas = apiFalsa({ 'GET /auth/yo': () => [200, { usuario }], ...manejadores });
  const render = renderRouter('./src/app', { initialUrl: '/' });
  await render;
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  if (render.getPathname() !== ruta) await act(async () => router.push(ruta));
  await waitFor(() => expect(render.getPathname()).toBe(ruta));
  return { llamadas, render, getPathname: () => render.getPathname() };
}

const pulsar = async (nombre) => fireEvent.press(await screen.findByRole('button', { name: nombre }));
const de = (llamadas, clave) => llamadas.filter((l) => l.clave === clave);
const modoAvion = () => act(async () => { global.__red.desconectar(); });
const volverLaSenal = () => act(async () => { global.__red.conectar(); });

/** Espera a que una consulta a la base local se cumpla (waitFor de RNTL no admite callbacks asíncronos). */
async function hasta(condicion, ms = 3000) {
  const fin = Date.now() + ms;
  while (!(await condicion())) {
    if (Date.now() > fin) throw new Error('La condición no se cumplió a tiempo');
    await act(() => new Promise((r) => setTimeout(r, 20)));
  }
}

async function llenarPublicacion() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Tomar foto' }));
  await waitFor(() => expect(screen.getByLabelText('Foto del producto')).toBeTruthy());
  await fireEvent.press(screen.getByRole('radio', { name: 'Papa' }));
  await fireEvent.changeText(screen.getByLabelText('Cantidad disponible'), '20');
  await fireEvent.changeText(screen.getByLabelText('Precio por bulto'), '85000');
}

describe('CU-02 + CU-17 · Publicar sin señal (CA-04)', () => {
  test('queda "Pendiente por sincronizar" y se publica sola al volver la red, con el mismo id', async () => {
    let publicados = [];
    const app = await abrirComo(usuarioRosa, '/productor/publicar', {
      'POST /productos': ({ cuerpo }) => {
        const d = JSON.parse(cuerpo.datos);
        publicados = [productoApi({ id: d.id, nombre: d.nombre, precio: d.precio, stock: d.stock })];
        return [201, { producto: publicados[0] }];
      },
      'GET /productos/mios': () => [200, { productos: publicados }],
      'GET /sync/pull': () => [200, pull(publicados)],
    });
    await modoAvion();
    await llenarPublicacion();
    await pulsar('Publicar');

    await waitFor(() => expect(app.getPathname()).toBe('/productor/productos'));
    expect(await screen.findByTestId('aviso-en-cola')).toHaveTextContent(/"Papa" quedó guardado en el teléfono/);
    expect(await screen.findByRole('button', { name: /^Papa, .*Pendiente por sincronizar$/ })).toBeTruthy();
    expect(screen.getAllByTestId('aviso-sin-senal').length).toBeGreaterThan(0);
    expect(screen.getByTestId('indicador-conexion').props.accessibilityLabel).toMatch(/Sin señal.*1 cambio pendiente/);
    expect(de(app.llamadas, 'POST /productos')).toHaveLength(0);
    // Las fotos se copiaron a documentos/cola/ (la caché temporal la puede borrar el sistema).
    expect((await operacionesEnCola())[0].archivos).toEqual({
      foto: `file:///documentos/cola/${ID_FIJO}.jpg`, miniatura: `file:///documentos/cola/${ID_FIJO}_min.jpg`,
    });

    await volverLaSenal();
    await waitFor(() => expect(de(app.llamadas, 'POST /productos')).toHaveLength(1));
    const [envio] = de(app.llamadas, 'POST /productos');
    expect(JSON.parse(envio.cuerpo.datos)).toMatchObject({ id: ID_FIJO, nombre: 'Papa', stock: 20, precio: 85000 });

    await waitFor(() => expect(screen.queryByText(/Pendiente por sincronizar/)).toBeNull());
    expect(await screen.findByText('Activa')).toBeTruthy();
    expect(global.__archivosBorrados).toEqual([`file:///documentos/cola/${ID_FIJO}.jpg`, `file:///documentos/cola/${ID_FIJO}_min.jpg`]);
    expect(await operacionesEnCola()).toEqual([]);
  });

  test('CU-17 A1: publicación rechazada queda "Con error" con su motivo y se puede descartar', async () => {
    const app = await abrirComo(usuarioRosa, '/productor/publicar', {
      'POST /productos': () => [413, { error: { codigo: 'FOTO_MUY_GRANDE', mensaje: 'La foto supera 300 KB.' } }],
      'GET /productos/mios': () => [200, { productos: [] }],
      'GET /sync/pull': () => [200, pull()],
    });
    await modoAvion();
    await llenarPublicacion();
    await pulsar('Publicar');
    await waitFor(() => expect(app.getPathname()).toBe('/productor/productos'));

    await volverLaSenal();
    expect(await screen.findByTestId('aviso-con-error')).toHaveTextContent(/Un cambio no se pudo publicar/);
    await pulsar(/^Papa, .*Con error$/);
    expect(await screen.findByTestId('aviso-error-sync')).toHaveTextContent(/No se pudo publicar: La foto supera 300 KB/);

    await pulsar('Descartar publicación');
    await waitFor(() => expect(app.getPathname()).toBe('/productor/productos'));
    await waitFor(() => expect(screen.queryByText(/Con error/)).toBeNull());
    expect(await operacionesEnCola()).toEqual([]);
    expect(global.__archivosBorrados).toHaveLength(2);
  });
});

describe('RF-10a + CU-17 · Editar sin señal', () => {
  test('dos cambios sin señal se combinan en una operación que se envía a /sync/push al volver la red', async () => {
    let servidor = productoApi();
    const app = await abrirComo(usuarioRosa, '/productor/editar/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: servidor }],
      'POST /sync/push': ({ cuerpo }) => {
        const [op] = cuerpo.operaciones;
        servidor = { ...servidor, ...op.datos, version: 2 };
        return [200, { resultados: [{ idOperacion: op.idOperacion, resultado: 'PUBLICADO', producto: servidor }] }];
      },
      'GET /sync/pull': () => [200, pull()],
    });
    expect(await screen.findByText('Activa')).toBeTruthy();
    await modoAvion();

    await fireEvent.changeText(screen.getByLabelText('Cantidad disponible'), '15');
    await pulsar('Guardar cambios');
    expect(await screen.findByTestId('aviso-editar')).toHaveTextContent(/Guardado en el teléfono/);
    expect(screen.getByTestId('estado-sync')).toHaveTextContent(/Pendiente por sincronizar/);

    await fireEvent.changeText(screen.getByLabelText('Precio por bulto'), '90000');
    await pulsar('Guardar cambios');
    await waitFor(() => expect(screen.getByLabelText('Precio por bulto').props.value).toBe('90000'));
    expect(await operacionesEnCola()).toHaveLength(1);

    await volverLaSenal();
    await waitFor(() => expect(de(app.llamadas, 'POST /sync/push')).toHaveLength(1));
    expect(de(app.llamadas, 'POST /sync/push')[0].cuerpo.operaciones).toEqual([expect.objectContaining({
      tipo: 'PRODUCTO.EDITAR', idEntidad: 'p-papa', datos: { precio: 90000, stock: 15, version: 1 },
    })]);
    await waitFor(() => expect(screen.queryByTestId('estado-sync')).toBeNull());
    expect(await operacionesEnCola()).toEqual([]);
  });

  test('CU-17 A2: con conflicto prevalece el servidor; "Con error" permite descartar el cambio', async () => {
    const vigente = productoApi({ precio: 95000, version: 2 });
    let huboPush = false;
    await abrirComo(usuarioRosa, '/productor/editar/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: huboPush ? vigente : productoApi() }],
      'GET /productos/mios': () => [200, { productos: [vigente] }],
      'POST /sync/push': ({ cuerpo }) => (huboPush = true) && [200, { resultados: [{
        idOperacion: cuerpo.operaciones[0].idOperacion,
        resultado: 'CON_ERROR',
        error: { codigo: 'CONFLICTO_VERSION', mensaje: 'La publicación cambió mientras la editaba.', detalles: { producto: vigente } },
      }] }],
      'GET /sync/pull': () => [200, pull()],
    });
    expect(await screen.findByText('Activa')).toBeTruthy();
    await modoAvion();
    await fireEvent.changeText(screen.getByLabelText('Precio por bulto'), '80000');
    await pulsar('Guardar cambios');
    await screen.findByTestId('aviso-editar');

    await volverLaSenal();
    expect(await screen.findByTestId('aviso-error-sync')).toHaveTextContent(/No se aplicó su cambio: La publicación cambió/);
    expect(screen.getByLabelText('Precio por bulto').props.value).toBe('95000'); // datos del servidor

    await act(async () => router.push('/productor/productos'));
    expect(await screen.findByTestId('aviso-con-error')).toBeTruthy();
    await pulsar(/^Papa pastusa, \$ 95\.000 .*Con error$/);

    await pulsar('Descartar mi cambio');
    expect(await screen.findByText('Cambio descartado. Ve los datos publicados.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('estado-sync')).toBeNull());
    expect(await operacionesEnCola()).toEqual([]);
  });

  test('cerrar sesión con cambios sin enviar pide confirmación y luego borra la copia local', async () => {
    await abrirComo(usuarioRosa, '/productor/editar/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: productoApi() }],
      'GET /sync/pull': () => [200, pull()],
    });
    expect(await screen.findByText('Activa')).toBeTruthy();
    await modoAvion();
    await fireEvent.changeText(screen.getByLabelText('Cantidad disponible'), '3');
    await pulsar('Guardar cambios');
    await screen.findByTestId('aviso-editar');

    await act(async () => router.push('/productor'));
    expect(await screen.findByRole('button', { name: 'Mis productos, 1 sin sincronizar' })).toBeTruthy();
    await pulsar('Cerrar sesión');
    expect(await screen.findByTestId('aviso-salida')).toHaveTextContent(/Tiene un cambio sin enviar/);
    await pulsar('Cerrar sesión de todos modos');
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
    await hasta(async () => (await operacionesEnCola()).length === 0);
  });
});

describe('CU-03 / CU-04 / CU-15 + CU-17 · Consultar sin señal', () => {
  const papa = productoApi();
  const cebolla = productoApi({ id: 'p-cebolla', nombre: 'Cebolla junca', categoria: 'HORTALIZAS', unidad: 'arroba', precio: 32000, municipio: 'Ocaña', fechaPublicacion: '2026-10-11T11:00:00Z' });
  const yuca = productoApi({ id: 'p-yuca', nombre: 'Yuca', categoria: 'TUBERCULOS', unidad: 'arroba', precio: 28000, municipio: 'Ocaña', fechaPublicacion: '2026-10-11T09:00:00Z' });

  test('el catálogo sale de la copia del teléfono con los mismos filtros y la fecha de sincronización', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor', {
      'GET /productos?pagina=1&tamano=20': () => [200, { productos: [papa], pagina: 1, tamano: 20, total: 1, hayMas: false }],
      'GET /sync/pull': () => [200, pull([papa, cebolla, yuca])],
    });
    expect(await screen.findByText('Papa pastusa')).toBeTruthy();
    await waitFor(() => expect(de(app.llamadas, 'GET /sync/pull')).toHaveLength(1));
    await hasta(async () => (await catalogoLocal({})).total === 3);

    await modoAvion();
    await pulsar('Filtro Municipio');
    await fireEvent.changeText(screen.getByLabelText('Buscar en Municipio'), 'oca');
    await pulsar('Ocaña');
    expect(await screen.findByText('Cebolla junca')).toBeTruthy();
    expect(screen.getByText('Yuca')).toBeTruthy();
    expect(screen.queryByText('Papa pastusa')).toBeNull();
    expect(screen.getByText('2 productos')).toBeTruthy();
    expect(screen.getByTestId('aviso-sin-senal')).toHaveTextContent(/sincronizado hoy \d{2}:\d{2}.*Puede agregar al carrito/);
  });

  test('el carrito y su clave sobreviven al cierre de la app: el reintento no duplica el pedido', async () => {
    const pedido = {
      id: 'ped-1', clave: 'x', estado: 'PENDIENTE', metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA', total: 85000,
      puntoEntrega: 'Parque', franjaEntrega: 'Mañana', motivoCancelacion: null, fecha: AHORA, actualizadoEn: AHORA, version: 1,
      consumidor: { id: 'u-andres', nombre: 'Andrés P.' }, productor: { id: 'u-rosa', nombre: 'Rosa P.', municipio: 'Pamplonita' },
      items: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 1, precioUnitario: 85000, subtotal: 85000 }],
    };
    let intento = 0;
    const manejadores = {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'GET /sync/pull': () => [200, pull([papa])],
      'POST /pedidos': () => (++intento === 1 ? 'SIN_RED' : [201, { pedidos: [pedido] }]),
      'GET /pedidos/ped-1': () => [200, { pedido }],
    };
    let app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', manejadores);
    await pulsar('🛒 Agregar al carrito');
    await pulsar('🛒 Ver carrito');
    await fireEvent.changeText(await screen.findByLabelText('Punto de entrega'), 'Parque');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mañana' }));
    await pulsar('Confirmar pedido');
    expect(await screen.findByTestId('aviso-carrito')).toHaveTextContent(/no se duplicará/);
    const primeraClave = de(app.llamadas, 'POST /pedidos')[0].cabeceras['Idempotency-Key'];

    // Se cierra la app y se vuelve a abrir.
    await act(async () => { screen.unmount(); });
    app = await abrirComo(usuarioAndres, '/consumidor', manejadores);
    expect(await screen.findByRole('button', { name: 'Mi carrito (1)' })).toBeTruthy();
    await pulsar('Mi carrito (1)');
    await fireEvent.changeText(await screen.findByLabelText('Punto de entrega'), 'Parque');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mañana' }));
    await pulsar('Confirmar pedido');
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/pedido/ped-1'));
    expect(de(app.llamadas, 'POST /pedidos')[0].cabeceras['Idempotency-Key']).toBe(primeraClave);
  });

  test('CU-15: sin señal los pedidos y su detalle salen de la copia local', async () => {
    const pedido = {
      id: 'ped-9', clave: 'c', estado: 'ACEPTADO', metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA', total: 170000,
      puntoEntrega: 'Parque', franjaEntrega: 'Tarde', motivoCancelacion: null, fecha: AHORA, actualizadoEn: AHORA, version: 2,
      consumidor: { id: 'u-andres', nombre: 'Andrés P.' }, productor: { id: 'u-rosa', nombre: 'Rosa P.', municipio: 'Pamplonita' },
      items: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 2, precioUnitario: 85000, subtotal: 170000 }],
    };
    await abrirComo(usuarioAndres, '/consumidor/pedidos', {
      'GET /pedidos?estado=activos': () => [200, { pedidos: [pedido] }],
      'GET /sync/pull': () => [200, pull([], { pedidos: [pedido] })],
    });
    expect(await screen.findByRole('button', { name: /Pedido de Rosa P\., Aceptado/ })).toBeTruthy();
    await hasta(async () => (await pedidosLocal()).length === 1);

    await modoAvion();
    await fireEvent.press(screen.getByRole('radio', { name: 'Todos' }));
    expect(await screen.findByTestId('aviso-sin-senal')).toBeTruthy();
    await pulsar(/Pedido de Rosa P\., Aceptado/);
    expect(await screen.findByTestId('total-pedido')).toHaveTextContent(/170\.000/);
    expect(screen.getByTestId('aviso-sin-senal')).toHaveTextContent(/El pago en línea necesita conexión/);
  });
});

describe('Motor de sincronización (protocolo push/pull)', () => {
  beforeEach(() => establecerToken('jwt-prueba'));

  test('envía la cola en orden cronológico y se detiene sin red para no alterar el orden', async () => {
    await encolarEdicion('p-x', { stock: 5 }, 3);
    await encolarPublicacion({ id: 'p-y', nombre: 'Yuca' }, { foto: 'file:///documentos/cola/p-y.jpg', miniatura: 'file:///documentos/cola/p-y_min.jpg' });
    await encolarEdicion('p-z', { precio: 1000 }, 1);
    const llamadas = apiFalsa({
      'POST /sync/push': ({ cuerpo }) => [200, { resultados: cuerpo.operaciones.map((o) => ({ idOperacion: o.idOperacion, resultado: 'PUBLICADO' })) }],
      'POST /productos': () => 'SIN_RED',
    });

    const r = await sincronizarAhora();
    expect(r).toMatchObject({ publicadas: 1, completo: false });
    expect(llamadas.map((l) => l.clave)).toEqual(['POST /sync/push', 'POST /productos']); // p-z espera su turno
    const quedan = await operacionesEnCola();
    expect(quedan.map((o) => [o.idEntidad, o.estado, o.intentos])).toEqual([['p-y', 'PENDIENTE', 1], ['p-z', 'PENDIENTE', 0]]);
  });

  test('una edición hecha mientras otra se envía toma la versión nueva cuando la primera se publica', async () => {
    const primera = await encolarEdicion('p-x', { stock: 5 }, 3);
    await marcarEnviando([primera]);
    const segunda = await encolarEdicion('p-x', { precio: 900 }, 3); // no se combina: la primera ya salió
    expect(segunda).not.toBe(primera);
    await quitarPublicada(primera, { idEntidad: 'p-x', versionNueva: 4 });
    const [op] = await operacionesEnCola();
    expect(op).toMatchObject({ id: segunda, payload: { precio: 900, version: 4 } });
  });

  test('pull: copia completa paginada la primera vez; luego solo cambios y retirados desde la marca', async () => {
    const a = productoApi({ id: 'p-a', nombre: 'A' });
    const b = productoApi({ id: 'p-b', nombre: 'B' });
    let ronda = 1;
    const llamadas = apiFalsa({
      'GET /sync/pull': ({ consulta }) => {
        if (ronda === 1 && !consulta.despuesDe) return [200, pull([a], { hayMas: true, siguiente: { desde: '2026-10-11T14:00:00.123456Z', despuesDe: 'p-a' } })];
        if (ronda === 1) return [200, { productos: [b], hayMas: false, siguiente: null, completa: false, servidorEn: '2026-10-11T15:00:05.000Z' }];
        return [200, pull([{ ...a, precio: 1 }], { completa: false, retirados: ['p-b'], servidorEn: '2026-10-11T16:00:00.000Z' })];
      },
    });

    await sincronizarAhora();
    expect((await catalogoLocal({})).productos.map((p) => p.id).sort()).toEqual(['p-a', 'p-b']);
    expect(await leerMeta('ultima_sincronizacion')).toBe(AHORA); // marca de la primera página
    expect(llamadas[1].consulta).toEqual({ desde: '2026-10-11T14:00:00.123456Z', despuesDe: 'p-a' });

    ronda = 2;
    await sincronizarAhora();
    expect(llamadas[2].consulta).toEqual({ desde: AHORA });
    const { productos } = await catalogoLocal({});
    expect(productos.map((p) => [p.id, p.precio])).toEqual([['p-a', 1]]);
  });
});
