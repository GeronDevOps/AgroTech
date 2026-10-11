import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import 'expo-secure-store'; // inicializa el almacén simulado (global.__almacenSeguro)
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { establecerToken } from '../src/api/cliente';
import { apiFalsa, productoApi, sesionDe, usuarioAndres, usuarioRosa } from './apiFalsa';

const CLAVE_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const CLAVE_2 = 'aaaaaaaa-0000-4000-8000-000000000002';

beforeEach(() => {
  global.__almacenSeguro?.clear();
  establecerToken(null);
  let n = 0;
  Crypto.randomUUID.mockImplementation(() => `aaaaaaaa-0000-4000-8000-00000000000${++n}`);
  WebBrowser.openAuthSessionAsync.mockClear();
});

/** Pedido como lo devuelve la API (pedidoPublico). */
function pedidoApi(extra = {}) {
  return {
    id: 'ped-1a2b3c4d', clave: CLAVE_1, estado: 'PENDIENTE', metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA',
    total: 170000, puntoEntrega: 'Parque principal', franjaEntrega: 'Mañana', motivoCancelacion: null,
    fecha: '2026-10-11T10:00:00Z', actualizadoEn: '2026-10-11T10:00:00Z', version: 1,
    consumidor: { id: 'u-andres', nombre: 'Andrés P.' },
    productor: { id: 'u-rosa', nombre: 'Rosa P.', municipio: 'Pamplonita' },
    items: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 2, precioUnitario: 85000, subtotal: 170000 }],
    historial: [{ estadoAnterior: null, estadoNuevo: 'PENDIENTE', fecha: '2026-10-11T10:00:00Z' }],
    pago: null,
    ...extra,
  };
}

async function abrirComo(usuario, ruta, manejadores) {
  global.__almacenSeguro.set('agrotech.sesion', JSON.stringify(sesionDe(usuario)));
  const llamadas = apiFalsa({ 'GET /auth/yo': () => [200, { usuario }], ...manejadores });
  const render = renderRouter('./src/app', { initialUrl: '/' });
  await render;
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  if (render.getPathname() !== ruta) await act(async () => router.push(ruta));
  await waitFor(() => expect(render.getPathname()).toBe(ruta));
  return { llamadas, getPathname: () => render.getPathname() };
}

const boton = (nombre) => screen.getByRole('button', { name: nombre });
const pulsar = async (nombre) => fireEvent.press(await screen.findByRole('button', { name: nombre }));
const confirmaciones = (llamadas) => llamadas.filter((l) => l.clave === 'POST /pedidos');

/** Agrega `cantidad` del producto abierto y entra al carrito. */
async function agregarYVerCarrito(cantidad) {
  await fireEvent.changeText(await screen.findByLabelText('¿Cuántos bultos?'), String(cantidad));
  await pulsar('🛒 Agregar al carrito');
  expect(await screen.findByTestId('aviso-agregado')).toHaveTextContent(/Agregó/);
  await pulsar('🛒 Ver carrito');
}

async function llenarEntrega() {
  await fireEvent.changeText(await screen.findByLabelText('Punto de entrega'), 'Parque principal');
  await fireEvent.press(screen.getByRole('radio', { name: 'Mañana' }));
}

const papa = productoApi();
const cebolla = productoApi({
  id: 'p-cebolla', nombre: 'Cebolla cabezona', categoria: 'HORTALIZAS', precio: 3000, unidad: 'kg', stock: 50,
  productor: { id: 'u-luis', nombre: 'Luis M.', verificado: true, calificacion: { promedio: null, total: 0 } },
});

describe('CU-04 · Carrito y confirmar pedido (AGRO-8)', () => {
  test('CP-06: agrega al carrito, confirma con la clave de idempotencia y muestra el comprobante', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'POST /pedidos': () => [201, { pedidos: [pedidoApi()] }],
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: pedidoApi() }],
    });
    await agregarYVerCarrito(2);
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/carrito'));
    expect(screen.getByTestId('total-carrito')).toHaveTextContent(/170\.000/);

    await llenarEntrega();
    await pulsar('Confirmar pedido');

    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/pedido/ped-1a2b3c4d'));
    expect(await screen.findByTestId('aviso-pedido')).toHaveTextContent(/Pedido confirmado/);
    expect(screen.getByTestId('total-pedido')).toHaveTextContent(/170\.000/);
    expect(screen.getByTestId('estado-pago')).toHaveTextContent(/contra entrega/);

    const [envio] = confirmaciones(app.llamadas);
    expect(envio.cabeceras['Idempotency-Key']).toBe(CLAVE_1);
    expect(envio.cuerpo).toEqual({
      items: [{ idProducto: 'p-papa', cantidad: 2 }], puntoEntrega: 'Parque principal', franjaEntrega: 'MANANA', metodoPago: 'CONTRA_ENTREGA',
    });
  });

  test('no deja agregar más de lo disponible', async () => {
    await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', { 'GET /productos/p-papa': () => [200, { producto: papa }] });
    await fireEvent.changeText(await screen.findByLabelText('¿Cuántos bultos?'), '25');
    await pulsar('🛒 Agregar al carrito');
    expect(screen.getByText('Solo hay 20 bultos disponibles.')).toBeTruthy();
    expect(screen.queryByTestId('aviso-agregado')).toBeNull();
  });

  test('sin datos de entrega no envía nada', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', { 'GET /productos/p-papa': () => [200, { producto: papa }] });
    await agregarYVerCarrito(1);
    await pulsar('Confirmar pedido');
    expect(await screen.findByText('Escriba dónde recibe el pedido.')).toBeTruthy();
    expect(screen.getByText('Elija mañana o tarde.')).toBeTruthy();
    expect(confirmaciones(app.llamadas)).toHaveLength(0);
  });

  test('RNF-10: si se pierde la respuesta, el reintento envía la MISMA clave y el carrito se conserva', async () => {
    let intento = 0;
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'POST /pedidos': () => (++intento === 1 ? 'SIN_RED' : [200, { pedidos: [pedidoApi()] }]),
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: pedidoApi() }],
    });
    await agregarYVerCarrito(2);
    await llenarEntrega();
    await pulsar('Confirmar pedido');
    expect(await screen.findByTestId('aviso-carrito')).toHaveTextContent(/no se duplicará/);
    expect(screen.getByTestId('total-carrito')).toHaveTextContent(/170\.000/);

    await pulsar('Confirmar pedido');
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/pedido/ped-1a2b3c4d'));
    const claves = confirmaciones(app.llamadas).map((l) => l.cabeceras['Idempotency-Key']);
    expect(claves).toEqual([CLAVE_1, CLAVE_1]);
  });

  test('si el carrito cambia después de un fallo, se usa una clave nueva', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'POST /pedidos': () => 'SIN_RED',
    });
    await agregarYVerCarrito(2);
    await llenarEntrega();
    await pulsar('Confirmar pedido');
    await screen.findByTestId('aviso-carrito');
    await pulsar('Restar 1');
    await pulsar('Confirmar pedido');
    await waitFor(() => expect(confirmaciones(app.llamadas)).toHaveLength(2));
    expect(confirmaciones(app.llamadas).map((l) => l.cabeceras['Idempotency-Key'])).toEqual([CLAVE_1, CLAVE_2]);
    expect(confirmaciones(app.llamadas)[1].cuerpo.items).toEqual([{ idProducto: 'p-papa', cantidad: 1 }]);
  });

  test('CP-07: con stock insuficiente (409) ajusta el carrito a lo disponible', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'POST /pedidos': () => [409, { error: {
        codigo: 'STOCK_INSUFICIENTE', mensaje: 'Otro comprador se adelantó.',
        detalles: { productos: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', disponible: 1, solicitado: 3 }] },
      } }],
    });
    await agregarYVerCarrito(3);
    await llenarEntrega();
    await pulsar('Confirmar pedido');
    expect(await screen.findByTestId('aviso-carrito')).toHaveTextContent(/Papa pastusa: hay 1.*ajustamos su carrito/);
    expect(screen.getByTestId('total-carrito')).toHaveTextContent(/85\.000/);
    expect(screen.getByLabelText('Cantidad de Papa pastusa en bultos').props.value).toBe('1');
    expect(app.getPathname()).toBe('/consumidor/carrito');
  });

  test('CU-04 A3: productos de dos productores crean dos pedidos y llevan a "Mis pedidos"', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'GET /productos/p-cebolla': () => [200, { producto: cebolla }],
      'POST /pedidos': () => [201, { pedidos: [pedidoApi(), pedidoApi({ id: 'ped-2', productor: { id: 'u-luis', nombre: 'Luis M.', municipio: 'Ábrego' } })] }],
      'GET /pedidos?estado=activos': () => [200, { pedidos: [pedidoApi(), pedidoApi({ id: 'ped-2', productor: { id: 'u-luis', nombre: 'Luis M.', municipio: 'Ábrego' } })] }],
    });
    await fireEvent.changeText(await screen.findByLabelText('¿Cuántos bultos?'), '1');
    await pulsar('🛒 Agregar al carrito');
    await act(async () => router.push('/consumidor/producto/p-cebolla'));
    await fireEvent.changeText(await screen.findByLabelText('¿Cuántos kilos?'), '5');
    await pulsar('🛒 Agregar al carrito');
    await pulsar('🛒 Ver carrito');

    expect(await screen.findByText(/se crea un pedido para cada uno/)).toBeTruthy();
    expect(screen.getByText('Pedido 1 · Rosa P.')).toBeTruthy();
    expect(screen.getByText('Pedido 2 · Luis M.')).toBeTruthy();
    await llenarEntrega();
    await pulsar('Confirmar pedido');

    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/pedidos'));
    expect(await screen.findByTestId('aviso-nuevos')).toHaveTextContent(/Se crearon 2 pedidos/);
    expect(await screen.findByRole('button', { name: /Pedido de Luis M\./ })).toBeTruthy();
  });
});

describe('CU-15 · Mis pedidos del consumidor (AGRO-9)', () => {
  test('CP-14: lista los pedidos con su estado y abre el detalle con el historial', async () => {
    const enCamino = pedidoApi({
      estado: 'EN_CAMINO',
      historial: [
        { estadoAnterior: null, estadoNuevo: 'PENDIENTE', fecha: '2026-10-11T10:00:00Z' },
        { estadoAnterior: 'PENDIENTE', estadoNuevo: 'ACEPTADO', fecha: '2026-10-11T11:00:00Z' },
        { estadoAnterior: 'ACEPTADO', estadoNuevo: 'EN_CAMINO', fecha: '2026-10-11T12:00:00Z' },
      ],
    });
    const app = await abrirComo(usuarioAndres, '/consumidor/pedidos', {
      'GET /pedidos?estado=activos': () => [200, { pedidos: [enCamino] }],
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: enCamino }],
    });
    await pulsar(/Pedido de Rosa P\., En camino, total \$\s?170\.000/);
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/pedido/ped-1a2b3c4d'));
    expect(await screen.findByLabelText('Estado: En camino, paso 3 de 4')).toBeTruthy();
    expect(screen.getByText('Historial')).toBeTruthy();
    expect(screen.getAllByText(/· ✔ Aceptado$/)).toHaveLength(1);
  });

  test('sin pedidos activos muestra el mensaje vacío', async () => {
    await abrirComo(usuarioAndres, '/consumidor/pedidos', { 'GET /pedidos?estado=activos': () => [200, { pedidos: [] }] });
    expect(await screen.findByTestId('pedidos-vacio')).toHaveTextContent(/No tiene pedidos activos/);
  });
});

describe('CU-22 · Pago en línea con Wompi (AGRO-21)', () => {
  const enLinea = (estadoPago) => pedidoApi({ metodoPago: 'EN_LINEA', estadoPago });

  test('CP-18: abre el checkout firmado por el servidor y, al volver, muestra el pago aprobado', async () => {
    let estadoPago = 'PENDIENTE';
    const app = await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: enLinea(estadoPago) }],
      'POST /pedidos/ped-1a2b3c4d/pago': () => {
        estadoPago = 'APROBADO'; // el evento firmado llega al servidor mientras el usuario paga
        return [201, { pago: { referencia: 'AGT-1', estado: 'PENDIENTE' }, urlCheckout: 'https://checkout.wompi.co/p/?reference=AGT-1' }];
      },
    });
    await pulsar('Pagar en línea');
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://checkout.wompi.co/p/?reference=AGT-1', 'agrotech://pago');
    expect(await screen.findByText(/Pago aprobado/)).toBeTruthy();
    expect(screen.getByTestId('estado-pago')).toHaveTextContent(/Pagado en línea/);
    expect(screen.queryByRole('button', { name: 'Pagar en línea' })).toBeNull();
    // La app no envía montos: el valor lo calcula el servidor (RF-21).
    expect(app.llamadas.find((l) => l.clave === 'POST /pedidos/ped-1a2b3c4d/pago').cuerpo).toBeUndefined();
  });

  test('pago rechazado: ofrece reintentar o cambiar a contra entrega', async () => {
    let pedido = enLinea('PENDIENTE');
    const app = await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido }],
      'POST /pedidos/ped-1a2b3c4d/pago': () => {
        pedido = enLinea('RECHAZADO');
        return [201, { pago: { referencia: 'AGT-1', estado: 'PENDIENTE' }, urlCheckout: 'https://checkout.wompi.co/p/?x' }];
      },
      'PATCH /pedidos/ped-1a2b3c4d/pago': () => {
        pedido = pedidoApi();
        return [200, { pedido }];
      },
    });
    await pulsar('Pagar en línea');
    expect(await screen.findByText(/El pago fue rechazado/)).toBeTruthy();
    expect(boton('Intentar el pago de nuevo')).toBeTruthy();

    await pulsar('Mejor pago contra entrega');
    expect(await screen.findByText(/pagará al productor cuando reciba/)).toBeTruthy();
    expect(screen.getByTestId('estado-pago')).toHaveTextContent(/contra entrega/);
    expect(app.llamadas.find((l) => l.clave === 'PATCH /pedidos/ped-1a2b3c4d/pago').cuerpo).toEqual({ metodoPago: 'CONTRA_ENTREGA' });
  });

  test('si la pasarela no está configurada (503) informa sin abrir el navegador', async () => {
    await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: enLinea('PENDIENTE') }],
      'POST /pedidos/ped-1a2b3c4d/pago': () => [503, { error: { codigo: 'PASARELA_NO_CONFIGURADA', mensaje: 'El pago en línea no está disponible en este momento.' } }],
    });
    await pulsar('Pagar en línea');
    expect(await screen.findByText('El pago en línea no está disponible en este momento.')).toBeTruthy();
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});

describe('CU-13 · Gestionar pedidos del productor (AGRO-9 / AGRO-19)', () => {
  test('el inicio muestra cuántos pedidos esperan respuesta', async () => {
    await abrirComo(usuarioRosa, '/productor', {
      'GET /pedidos?estado=activos': () => [200, { pedidos: [pedidoApi(), pedidoApi({ id: 'ped-2' }), pedidoApi({ id: 'ped-3', estado: 'ACEPTADO' })] }],
    });
    expect(await screen.findByRole('button', { name: 'Mis pedidos, 2 por atender' })).toBeTruthy();
  });

  test('CP-08: acepta, marca en camino y entregado enviando la versión', async () => {
    let pedido = pedidoApi();
    const app = await abrirComo(usuarioRosa, '/productor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido }],
      'PATCH /pedidos/ped-1a2b3c4d/estado': ({ cuerpo }) => {
        pedido = { ...pedido, estado: cuerpo.estado, version: pedido.version + 1 };
        return [200, { pedido }];
      },
    });
    await pulsar('✔ Aceptar pedido');
    expect(await screen.findByLabelText('Estado: Aceptado, paso 2 de 4')).toBeTruthy();
    await pulsar('🚚 Marcar en camino');
    expect(await screen.findByLabelText('Estado: En camino, paso 3 de 4')).toBeTruthy();
    await pulsar('✅ Marcar entregado');
    expect(await screen.findByLabelText('Estado: Entregado, paso 4 de 4')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Marcar/ })).toBeNull();

    const envios = app.llamadas.filter((l) => l.clave === 'PATCH /pedidos/ped-1a2b3c4d/estado').map((l) => l.cuerpo);
    expect(envios).toEqual([{ estado: 'ACEPTADO', version: 1 }, { estado: 'EN_CAMINO', version: 2 }, { estado: 'ENTREGADO', version: 3 }]);
  });

  test('rechazar exige motivo y lo envía al consumidor', async () => {
    let pedido = pedidoApi();
    const app = await abrirComo(usuarioRosa, '/productor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido }],
      'PATCH /pedidos/ped-1a2b3c4d/estado': ({ cuerpo }) => {
        pedido = { ...pedido, estado: 'CANCELADO', motivoCancelacion: cuerpo.motivo, version: 2 };
        return [200, { pedido }];
      },
    });
    await pulsar('✖ Rechazar');
    await pulsar('Confirmar rechazo');
    expect(await screen.findByText('Escriba el motivo para el consumidor.')).toBeTruthy();
    expect(app.llamadas.filter((l) => l.clave.startsWith('PATCH'))).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Motivo del rechazo'), 'No alcanzo a cosechar');
    await pulsar('Confirmar rechazo');
    expect(await screen.findByTestId('aviso-pedido')).toHaveTextContent(/inventario volvió/);
    expect(screen.getByText('Motivo: No alcanzo a cosechar')).toBeTruthy();
    expect(app.llamadas.find((l) => l.clave.startsWith('PATCH')).cuerpo).toEqual({ estado: 'CANCELADO', version: 1, motivo: 'No alcanzo a cosechar' });
  });

  test('RF-21: con pago en línea sin aprobar, "Aceptar" queda deshabilitado', async () => {
    await abrirComo(usuarioRosa, '/productor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: pedidoApi({ metodoPago: 'EN_LINEA', estadoPago: 'PENDIENTE' }) }],
    });
    expect(await screen.findByTestId('aviso-espera-pago')).toBeTruthy();
    expect(boton('✔ Aceptar pedido')).toBeDisabled();
    expect(boton('✖ Rechazar')).not.toBeDisabled();
  });

  test('conflicto de versión: informa y recarga el pedido', async () => {
    let lecturas = 0;
    await abrirComo(usuarioRosa, '/productor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => { lecturas += 1; return [200, { pedido: pedidoApi() }]; },
      'PATCH /pedidos/ped-1a2b3c4d/estado': () => [409, { error: { codigo: 'CONFLICTO_VERSION', mensaje: 'El pedido cambió mientras lo veía. Revise los datos.' } }],
    });
    await pulsar('✔ Aceptar pedido');
    expect(await screen.findByText('El pedido cambió mientras lo veía. Revise los datos.')).toBeTruthy();
    await waitFor(() => expect(lecturas).toBeGreaterThanOrEqual(2));
  });
});
