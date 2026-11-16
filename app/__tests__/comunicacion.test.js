import { Platform } from 'react-native';
import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import 'expo-secure-store'; // inicializa el almacén simulado (global.__almacenSeguro)
import 'expo-notifications'; // inicializa global.__push
import { establecerToken } from '../src/api/cliente';
import { operacionesEnCola } from '../src/local/cola';
import { registrarPush } from '../src/notificaciones/push';
import { apiFalsa, productoApi, sesionDe, usuarioAndres, usuarioRosa } from './apiFalsa';

const AHORA = '2026-10-11T15:00:00.000Z';

beforeEach(() => {
  global.__almacenSeguro?.clear();
  establecerToken(null);
});

function pedidoApi(extra = {}) {
  return {
    id: 'ped-1', clave: 'c', estado: 'ACEPTADO', metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA', total: 170000,
    puntoEntrega: 'Parque principal', franjaEntrega: 'Mañana', motivoCancelacion: null, fecha: AHORA, actualizadoEn: AHORA, version: 2,
    consumidor: { id: 'u-andres', nombre: 'Andrés P.' }, productor: { id: 'u-rosa', nombre: 'Rosa P.', municipio: 'Pamplonita' },
    items: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 2, precioUnitario: 85000, subtotal: 170000 }],
    historial: [], pago: null, calificacion: null, mensajesSinLeer: 0,
    ...extra,
  };
}
const msg = (extra) => ({ id: 'm-1', idPedido: 'ped-1', idEmisor: 'u-rosa', contenido: 'Hola, ¿a qué hora?', fecha: '2026-10-11T14:00:00.000Z', leido: false, leidoEn: null, ...extra });

async function abrirComo(usuario, ruta, manejadores) {
  global.__almacenSeguro.set('agrotech.sesion', JSON.stringify(sesionDe(usuario)));
  const llamadas = apiFalsa({ 'GET /auth/yo': () => [200, { usuario }], ...manejadores });
  const render = await renderRouter('./src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  if (render.getPathname() !== ruta) await act(async () => router.push(ruta));
  await waitFor(() => expect(render.getPathname()).toBe(ruta));
  return { llamadas, getPathname: () => render.getPathname() };
}

const pulsar = async (nombre) => fireEvent.press(await screen.findByRole('button', { name: nombre }));
const de = (llamadas, clave) => llamadas.filter((l) => l.clave === clave);
const emitir = (evento) => act(async () => { global.__ws.emitir(evento); });
const conectadoWs = () => waitFor(() => expect(global.__ws.autenticadas().length).toBeGreaterThan(0));
const modoAvion = () => act(async () => { global.__red.desconectar(); });
const volverLaSenal = () => act(async () => { global.__red.conectar(); });

async function escribir(textoMensaje) {
  await fireEvent.changeText(await screen.findByLabelText('Escriba un mensaje'), textoMensaje);
}

describe('CU-05 · Chat por pedido (AGRO-11)', () => {
  test('CA-09: carga el historial, marca leído lo recibido, envía y recibe en tiempo real', async () => {
    let enviados = [];
    const app = await abrirComo(usuarioAndres, '/consumidor/chat/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi() }],
      'GET /pedidos/ped-1/mensajes': () => [200, { abierto: true, estadoPedido: 'ACEPTADO', mensajes: [msg(), ...enviados] }],
      'POST /pedidos/ped-1/mensajes': ({ cuerpo }) => {
        const m = msg({ id: cuerpo.id, idEmisor: 'u-andres', contenido: cuerpo.contenido, fecha: '2026-10-11T14:05:00.000Z' });
        enviados = [m];
        return [201, { mensaje: m }];
      },
      'POST /pedidos/ped-1/mensajes/leidos': () => [200, { leidos: 1 }],
    });
    expect(await screen.findByText('Hola, ¿a qué hora?')).toBeTruthy();
    await waitFor(() => expect(de(app.llamadas, 'POST /pedidos/ped-1/mensajes/leidos')).toHaveLength(1));

    await escribir('  A las 9 en el parque  ');
    await pulsar('Enviar');
    await waitFor(() => expect(de(app.llamadas, 'POST /pedidos/ped-1/mensajes')).toHaveLength(1));
    const { cuerpo } = de(app.llamadas, 'POST /pedidos/ped-1/mensajes')[0];
    expect(cuerpo.contenido).toBe('A las 9 en el parque');
    expect(cuerpo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByLabelText(/^Usted, \d{2}:\d{2}: A las 9 en el parque · ✓ Enviado$/)).toBeTruthy();
    expect(screen.getByLabelText('Escriba un mensaje').props.value).toBe('');

    // La respuesta de Rosa llega por WebSocket y se marca leída al estar en la pantalla.
    await conectadoWs();
    await emitir({ tipo: 'mensaje', mensaje: msg({ id: 'm-3', contenido: 'Perfecto, allá nos vemos', fecha: '2026-10-11T14:06:00.000Z' }) });
    expect(await screen.findByText('Perfecto, allá nos vemos')).toBeTruthy();
    await waitFor(() => expect(de(app.llamadas, 'POST /pedidos/ped-1/mensajes/leidos')).toHaveLength(2));

    // Rosa lee el mensaje de Andrés: ✓✓ Leído.
    await emitir({ tipo: 'mensajes_leidos', idPedido: 'ped-1', idLector: 'u-rosa', ids: [cuerpo.id] });
    expect(await screen.findByLabelText(/A las 9 en el parque · ✓✓ Leído$/)).toBeTruthy();
  });

  test('CU-05 A1: sin señal el mensaje queda ⏳ Pendiente y se reenvía solo con el mismo id', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/chat/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi() }],
      'GET /pedidos/ped-1/mensajes': () => [200, { abierto: true, estadoPedido: 'ACEPTADO', mensajes: [msg()] }],
      'POST /sync/push': ({ cuerpo }) => [200, { resultados: cuerpo.operaciones.map((o) => ({
        idOperacion: o.idOperacion, resultado: 'PUBLICADO', mensaje: msg({ id: o.idEntidad, idEmisor: 'u-andres', contenido: o.datos.contenido }),
      })) }],
      'GET /sync/pull': () => [200, { servidorEn: AHORA, completa: false, productos: [], hayMas: false, siguiente: null, retirados: [], pedidos: [] }],
    });
    expect(await screen.findByText('Hola, ¿a qué hora?')).toBeTruthy();
    await modoAvion();
    await escribir('Voy en camino');
    await pulsar('Enviar');
    expect(await screen.findByLabelText(/Voy en camino · ⏳ Pendiente$/)).toBeTruthy();
    const [op] = await operacionesEnCola();
    expect(op).toMatchObject({ entidad: 'MENSAJE', tipo: 'CREAR', payload: { idPedido: 'ped-1', contenido: 'Voy en camino' } });

    await volverLaSenal();
    await waitFor(() => expect(de(app.llamadas, 'POST /sync/push')).toHaveLength(1));
    expect(de(app.llamadas, 'POST /sync/push')[0].cuerpo.operaciones).toEqual([expect.objectContaining({
      tipo: 'MENSAJE.CREAR', idEntidad: op.idEntidad, datos: { idPedido: 'ped-1', contenido: 'Voy en camino' },
    })]);
  });

  test('CU-05 A2: con el pedido entregado el chat queda en solo lectura', async () => {
    await abrirComo(usuarioAndres, '/consumidor/chat/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi({ estado: 'ENTREGADO' }) }],
      'GET /pedidos/ped-1/mensajes': () => [200, { abierto: false, estadoPedido: 'ENTREGADO', mensajes: [msg({ leido: true })] }],
    });
    expect(await screen.findByTestId('chat-cerrado')).toHaveTextContent(/solo lectura/);
    expect(screen.queryByLabelText('Escriba un mensaje')).toBeNull();
  });

  test('CU-05 A3: vacío o más de 500 caracteres no se puede enviar', async () => {
    await abrirComo(usuarioAndres, '/consumidor/chat/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi() }],
      'GET /pedidos/ped-1/mensajes': () => [200, { abierto: true, estadoPedido: 'ACEPTADO', mensajes: [] }],
    });
    expect(await screen.findByTestId('chat-vacio')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await escribir('   ');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await escribir('a'.repeat(501));
    expect(screen.getByText('Sobran 1 caracteres')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  test('el detalle del pedido abre el chat y muestra los mensajes nuevos', async () => {
    const app = await abrirComo(usuarioRosa, '/productor/pedido/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi({ mensajesSinLeer: 2 }) }],
      'GET /pedidos/ped-1/mensajes': () => [200, { abierto: true, estadoPedido: 'ACEPTADO', mensajes: [] }],
    });
    await pulsar('Chat con Andrés P., 2 mensajes nuevos');
    await waitFor(() => expect(app.getPathname()).toBe('/productor/chat/ped-1'));
  });

  test('bandeja "Mensajes": conversaciones con no leídos; un mensaje en vivo la sube y suma', async () => {
    await abrirComo(usuarioRosa, '/productor/mensajes', {
      'GET /mensajes': () => [200, { conversaciones: [
        { idPedido: 'ped-2', estadoPedido: 'PENDIENTE', abierto: true, total: 1, contraparte: 'María P.', ultimoMensaje: { contenido: 'Hola', fecha: AHORA, propio: false }, sinLeer: 1 },
        { idPedido: 'ped-1', estadoPedido: 'ACEPTADO', abierto: true, total: 1, contraparte: 'Andrés P.', ultimoMensaje: { contenido: 'Gracias', fecha: AHORA, propio: true }, sinLeer: 0 },
      ] }],
    });
    expect(await screen.findByRole('button', { name: /^Chat con María P\., 1 sin leer/ })).toBeTruthy();
    expect(screen.getByText('Usted: Gracias')).toBeTruthy();
    await conectadoWs();
    await emitir({ tipo: 'mensaje', mensaje: msg({ idEmisor: 'u-andres', contenido: '¿Ya salió?', id: 'm-9' }) });
    expect(await screen.findByRole('button', { name: /^Chat con Andrés P\., 1 sin leer\. Último: ¿Ya salió\?/ })).toBeTruthy();
    const botones = screen.getAllByRole('button', { name: /^Chat con/ });
    expect(botones[0].props.accessibilityLabel).toMatch(/Andrés/);
  });
});

describe('CU-06 · Calificar al productor (AGRO-12)', () => {
  test('CA-10: con el pedido entregado califica con estrellas y comentario; luego queda en solo lectura', async () => {
    let calificacion = null;
    const app = await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi({ estado: 'ENTREGADO', calificacion }) }],
      'POST /pedidos/ped-1/calificacion': ({ cuerpo }) => {
        calificacion = { ...cuerpo, fecha: AHORA };
        return [201, { calificacion, reputacion: { promedio: 4, total: 1 } }];
      },
    });
    await screen.findByTestId('calificar');
    await pulsar('Enviar calificación');
    expect(await screen.findByTestId('error-calificar')).toHaveTextContent(/Toque las estrellas/);

    await fireEvent.press(screen.getByRole('radio', { name: '4 estrellas, Bueno' }));
    expect(screen.getByText('Bueno')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Comentario (opcional)'), 'Buena papa');
    await pulsar('Enviar calificación');
    expect(await screen.findByTestId('calificacion-hecha')).toHaveTextContent(/Buena papa/);
    expect(de(app.llamadas, 'POST /pedidos/ped-1/calificacion')[0].cuerpo).toEqual({ puntuacion: 4, comentario: 'Buena papa' });
    expect(screen.queryByTestId('calificar')).toBeNull();
  });

  test('CU-06 A1: si el pedido no está entregado no se puede calificar', async () => {
    await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1', { 'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi() }] });
    await screen.findByTestId('total-pedido');
    expect(screen.queryByTestId('calificar')).toBeNull();
  });

  test('CU-06 A3: sin señal la calificación se guarda en el teléfono y se envía después', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1', {
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi({ estado: 'ENTREGADO' }) }],
      'POST /sync/push': ({ cuerpo }) => [200, { resultados: cuerpo.operaciones.map((o) => ({ idOperacion: o.idOperacion, resultado: 'PUBLICADO', calificacion: { ...o.datos, fecha: AHORA } })) }],
    });
    await screen.findByTestId('calificar');
    await modoAvion();
    await fireEvent.press(screen.getByRole('radio', { name: '5 estrellas, Excelente' }));
    await pulsar('Enviar calificación');
    expect(await screen.findByTestId('calificacion-hecha')).toHaveTextContent(/Se enviará cuando haya señal/);
    await volverLaSenal();
    await waitFor(() => expect(de(app.llamadas, 'POST /sync/push')).toHaveLength(1));
    expect(de(app.llamadas, 'POST /sync/push')[0].cuerpo.operaciones[0]).toMatchObject({ tipo: 'CALIFICACION.CREAR', idEntidad: 'ped-1', datos: { puntuacion: 5 } });
  });

  test('CU-06 paso 4: las opiniones del productor se ven desde el producto', async () => {
    const app = await abrirComo(usuarioAndres, '/consumidor/producto/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: productoApi({ productor: { id: 'u-rosa', nombre: 'Rosa P.', verificado: false, calificacion: { promedio: 4.5, total: 2 } } }) }],
      'GET /productores/u-rosa/calificaciones': () => [200, {
        productor: { id: 'u-rosa', nombre: 'Rosa P.', municipio: 'Pamplonita', verificado: false },
        reputacion: { promedio: 4.5, total: 2 },
        calificaciones: [
          { puntuacion: 5, comentario: 'Excelente', fecha: AHORA, consumidor: 'María P.' },
          { puntuacion: 4, comentario: null, fecha: AHORA, consumidor: 'Andrés P.' },
        ],
        pagina: 1, hayMas: false,
      }],
    });
    await pulsar('Ver opiniones (2)');
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor/productor/u-rosa'));
    expect(await screen.findByText('Excelente')).toBeTruthy();
    expect(screen.getByText('— María P.')).toBeTruthy();
    expect(screen.getByLabelText('4,5 de 5 estrellas, 2 opiniones')).toBeTruthy();
  });
});

describe('CU-07 · Mis ventas (AGRO-13)', () => {
  const ventas = (extra = {}) => ({
    periodo: { codigo: 'mes', nombre: 'Este mes', desde: '2026-10-01', hasta: '2026-10-03', agrupacion: 'dia' },
    correccion: null,
    resumen: { pedidosEntregados: 2, ingresos: 268500, ticketPromedio: 134250 },
    serie: [
      { fecha: '2026-10-01', pedidos: 0, ingresos: 0 },
      { fecha: '2026-10-02', pedidos: 1, ingresos: 170000 },
      { fecha: '2026-10-03', pedidos: 1, ingresos: 98500 },
    ],
    topProductos: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 3, ingresos: 255000, pedidos: 2 }],
    enCurso: { pedidos: 1, valor: 85000 },
    generadoEn: AHORA,
    ...extra,
  });

  test('CA-11: muestra pedidos entregados, ingresos, el gráfico y lo que más vende; cambia de periodo', async () => {
    const app = await abrirComo(usuarioRosa, '/productor/ventas', {
      'GET /ventas?periodo=mes': () => [200, ventas()],
      'GET /ventas?periodo=mes_anterior': () => [200, ventas({ resumen: { pedidosEntregados: 0, ingresos: 0, ticketPromedio: 0 }, serie: [], topProductos: [] })],
    });
    expect(await screen.findByTestId('kpi-ingresos')).toHaveTextContent(/\$ 268\.500/);
    expect(screen.getByTestId('kpi-pedidos')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('kpi-promedio')).toHaveTextContent(/134\.250/);
    expect(screen.getByLabelText(/^1\. Papa pastusa: 3 bultos, \$ 255\.000, 2 pedidos$/)).toBeTruthy();
    expect(screen.getByTestId('en-curso')).toHaveTextContent(/1 pedido por \$ 85\.000/);

    await pulsar('2 oct: $ 170.000');
    expect(screen.getByText('2 oct: $ 170.000 · 1 pedido')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Mes pasado' }));
    expect(await screen.findByTestId('sin-ventas')).toHaveTextContent(/Una venta cuenta cuando marca el pedido como ✅ Entregado/);
    expect(de(app.llamadas, 'GET /ventas?periodo=mes_anterior')).toHaveLength(1);
  });

  test('CU-07 A2: sin señal muestra las últimas cifras guardadas con su corte', async () => {
    await abrirComo(usuarioRosa, '/productor/ventas', { 'GET /ventas?periodo=mes': () => [200, ventas()] });
    await screen.findByTestId('kpi-ingresos');
    await act(async () => router.back());
    await modoAvion();
    await act(async () => router.push('/productor/ventas'));
    expect(await screen.findByTestId('aviso-sin-senal')).toHaveTextContent(/Cifras con corte/);
    expect(screen.getByTestId('kpi-ingresos')).toHaveTextContent(/\$ 268\.500/);
  });
});

describe('Tiempo real y avisos (AGRO-20 · RF-16a)', () => {
  test('CA-06: un pedido nuevo recarga la lista del productor y muestra el aviso para abrirlo', async () => {
    let pedidos = [];
    const app = await abrirComo(usuarioRosa, '/productor/pedidos', {
      'GET /pedidos?estado=activos': () => [200, { pedidos }],
      'GET /pedidos/ped-1': () => [200, { pedido: pedidoApi({ estado: 'PENDIENTE' }) }],
    });
    expect(await screen.findByTestId('pedidos-vacio')).toBeTruthy();
    await conectadoWs();
    pedidos = [pedidoApi({ estado: 'PENDIENTE' })];
    await emitir({ tipo: 'pedido_nuevo', idPedido: 'ped-1' });
    expect(await screen.findByRole('button', { name: /Pedido de Andrés P\., Pendiente/ })).toBeTruthy();
    expect(await screen.findByTestId('aviso-pedido-nuevo')).toBeTruthy();
    await pulsar('Ver pedido nuevo');
    await waitFor(() => expect(app.getPathname()).toBe('/productor/pedido/ped-1'));
    expect(screen.queryByTestId('aviso-pedido-nuevo')).toBeNull();
  });

  test('el inicio del productor muestra los mensajes sin leer', async () => {
    await abrirComo(usuarioRosa, '/productor', {
      'GET /pedidos?estado=activos': () => [200, { pedidos: [pedidoApi({ mensajesSinLeer: 2 }), pedidoApi({ id: 'ped-2', mensajesSinLeer: 1 })] }],
    });
    expect(await screen.findByRole('button', { name: 'Mensajes, 3 sin leer' })).toBeTruthy();
  });

  test('CU-16: en Android registra el teléfono, abre el pedido al tocar el aviso y lo desregistra al salir', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const app = await abrirComo(usuarioRosa, '/productor', {
      'POST /dispositivos': () => [201, { dispositivo: { id: 'd-1', estado: 'VIGENTE' } }],
      'DELETE /dispositivos/fcm-token-de-prueba-0123456789%3AAPA91b': () => [204],
      'GET /pedidos/ped-7': () => [200, { pedido: pedidoApi({ id: 'ped-7', estado: 'PENDIENTE' }) }],
    });
    await waitFor(() => expect(de(app.llamadas, 'POST /dispositivos')).toHaveLength(1));
    expect(de(app.llamadas, 'POST /dispositivos')[0].cuerpo).toEqual({ token: 'fcm-token-de-prueba-0123456789:APA91b', plataforma: 'ANDROID' });

    await act(async () => global.__push.tocar({ idPedido: 'ped-7', tipo: 'PEDIDO_NUEVO' }));
    await waitFor(() => expect(app.getPathname()).toBe('/productor/pedido/ped-7'));

    await act(async () => router.push('/productor'));
    await pulsar('Cerrar sesión');
    await waitFor(() => expect(de(app.llamadas, 'DELETE /dispositivos/fcm-token-de-prueba-0123456789%3AAPA91b')).toHaveLength(1));
  });

  test('CU-16 A1: con el permiso negado no registra el teléfono (los avisos quedan dentro de la app)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    global.__push.permiso = 'denied';
    apiFalsa({});
    establecerToken('jwt');
    expect(await registrarPush()).toBeNull();
  });
});
