// Pruebas de la app para los requisitos de la Fase 2 del SRS (v1.1.0):
// CU-08 recuperar contraseña · CU-09 perfil · CU-10 pausar/retirar · CU-11/12 búsqueda, orden y cercanía ·
// CU-14 cancelar · CU-15 historial · CU-16 avisos · CU-18 panel · CU-19 reportar · CU-20 privacidad
import { router } from 'expo-router';
import { act, renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { establecerToken } from '../src/api/cliente';
import { apiFalsa, productoApi, sesionDe, usuarioAndres, usuarioRosa } from './apiFalsa';

const usuarioAdmin = { ...usuarioRosa, id: 'u-admin', nombres: 'Ana', apellidos: 'Vera', correo: 'admin@demo.co', rol: 'ADMINISTRADOR' };

beforeEach(() => {
  global.__almacenSeguro?.clear();
  global.__red?.conectar();
  establecerToken(null);
  let n = 0;
  Crypto.randomUUID.mockImplementation(() => `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`);
});

function pedidoApi(extra = {}) {
  return {
    id: 'ped-1a2b3c4d', clave: 'c1', estado: 'ACEPTADO', metodoPago: 'CONTRA_ENTREGA', estadoPago: 'NO_APLICA',
    total: 170000, puntoEntrega: 'Parque principal', franjaEntrega: 'Mañana', motivoCancelacion: null,
    fecha: '2026-10-11T10:00:00Z', actualizadoEn: '2026-10-11T10:00:00Z', version: 2,
    consumidor: { id: 'u-andres', nombre: 'Andrés P.' }, productor: { id: 'u-rosa', nombre: 'Rosa P.', municipio: 'Pamplonita' },
    items: [{ idProducto: 'p-papa', nombre: 'Papa pastusa', unidad: 'bulto', cantidad: 2, precioUnitario: 85000, subtotal: 170000 }],
    historial: [{ estadoAnterior: null, estadoNuevo: 'PENDIENTE', fecha: '2026-10-11T10:00:00Z' }],
    pago: null, acciones: ['CHAT', 'CANCELAR', 'REPORTAR'], mensajesSinLeer: 0,
    ...extra,
  };
}

async function abrirComo(usuario, ruta, manejadores, sesionExtra = {}) {
  if (usuario) global.__almacenSeguro.set('agrotech.sesion', JSON.stringify({ ...sesionDe(usuario), ...sesionExtra }));
  const llamadas = apiFalsa({
    'GET /auth/yo': () => [200, { usuario, ...sesionExtra }],
    'GET /notificaciones': () => [200, { notificaciones: [], sinLeer: 0 }],
    ...manejadores,
  });
  const render = await renderRouter('./src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  if (ruta && render.getPathname() !== ruta) await act(async () => router.push(ruta));
  if (ruta) await waitFor(() => expect(render.getPathname()).toBe(ruta));
  return { llamadas, getPathname: () => render.getPathname() };
}

const pulsar = async (nombre) => fireEvent.press(await screen.findByRole('button', { name: nombre }));
const escribir = async (etiqueta, valor) => fireEvent.changeText(await screen.findByLabelText(etiqueta), valor);

describe('CU-08 · Recuperar la contraseña', () => {
  test('pide el código, cambia la contraseña y entra con la sesión nueva', async () => {
    const { llamadas, getPathname } = await abrirComo(null, '/iniciar-sesion', {
      'POST /auth/recuperar': () => [202, { mensaje: 'Si el correo está registrado, le enviamos un código de 6 dígitos.' }],
      'POST /auth/restablecer': ({ cuerpo }) => (cuerpo.codigo === '123456'
        ? [200, sesionDe(usuarioRosa)]
        : [400, { error: { codigo: 'CODIGO_INCORRECTO', mensaje: 'El código no coincide.', detalles: { intentosRestantes: 2 } } }]),
      'GET /productos/mios': () => [200, { productos: [] }],
      'GET /pedidos?estado=activos': () => [200, { pedidos: [] }],
    });
    await pulsar('¿Olvidó su contraseña?');
    await escribir('Correo', 'rosa@correo.co');
    await pulsar('Enviar código');
    expect(await screen.findByTestId('aviso-recuperar')).toHaveTextContent(/Si el correo está registrado/);
    await escribir('Código de 6 dígitos', '000000');
    await escribir('Nueva contraseña', 'nuevaClave2026');
    await pulsar('Cambiar contraseña');
    expect(await screen.findByTestId('aviso-recuperar')).toHaveTextContent(/Le quedan 2 intento/);
    await escribir('Código de 6 dígitos', '123456');
    await pulsar('Cambiar contraseña');
    await waitFor(() => expect(getPathname()).toBe('/productor'));
    expect(llamadas.filter((l) => l.clave === 'POST /auth/restablecer').map((l) => l.cuerpo.codigo)).toEqual(['000000', '123456']);
  });
});

describe('CU-20 A3 · Aviso de privacidad nuevo', () => {
  test('pide aceptar la nueva versión y la registra', async () => {
    const { llamadas } = await abrirComo(usuarioAndres, null, {
      'GET /productos?pagina=1&tamano=20': () => [200, { productos: [], pagina: 1, tamano: 20, total: 0, hayMas: false }],
      'POST /auth/autorizacion': () => [200, { usuario: usuarioAndres, requiereAutorizacion: false }],
    }, { requiereAutorizacion: true, versionAviso: '2.0' });
    await pulsar('Acepto el tratamiento de mis datos');
    await waitFor(() => expect(screen.queryByText('Acepto el tratamiento de mis datos')).toBeNull());
    expect(llamadas.find((l) => l.clave === 'POST /auth/autorizacion').cuerpo).toEqual({ version: '2.0' });
  });
});

describe('CU-09 · Mi perfil', () => {
  const perfil = { ...usuarioAndres, ubicacion: { lat: 7.89, lon: -72.5, origen: 'MUNICIPIO' } };

  test('marca el celular en uso por otra cuenta (A2) y guarda la ubicación del teléfono', async () => {
    const { llamadas } = await abrirComo(usuarioAndres, '/consumidor/perfil', {
      'GET /perfil': () => [200, { perfil }],
      'PATCH /perfil': ({ cuerpo }) => (cuerpo.telefono
        ? [409, { error: { codigo: 'DATO_EN_USO', mensaje: 'Ese celular ya pertenece a otra cuenta.', detalles: { campo: 'telefono' } } }]
        : [200, { perfil: { ...perfil, ubicacion: { ...cuerpo.ubicacion, origen: 'TELEFONO' } } }]),
    });
    await escribir('Celular', '310 555 0000');
    await pulsar('Guardar cambios');
    expect(await screen.findByText('Ese celular ya pertenece a otra cuenta.')).toBeTruthy();
    await escribir('Celular', usuarioAndres.telefono);
    await pulsar('Usar la ubicación de mi teléfono');
    expect(await screen.findByTestId('aviso-perfil')).toHaveTextContent(/ubicación de su teléfono/);
    expect(llamadas.filter((l) => l.clave === 'PATCH /perfil').pop().cuerpo).toEqual({ ubicacion: { lat: 7.3756, lon: -72.6478 } });
  });

  test('A3 sin señal: el cambio queda en la cola como PERFIL.EDITAR', async () => {
    await abrirComo(usuarioAndres, '/consumidor/perfil', { 'GET /perfil': () => [200, { perfil }] });
    await screen.findByLabelText('Vereda o dirección (opcional)');
    global.__red.desconectar();
    await escribir('Vereda o dirección (opcional)', 'Barrio La Libertad');
    await pulsar('Guardar cambios');
    expect(await screen.findByTestId('aviso-perfil')).toHaveTextContent(/Guardado en el teléfono/);
  });
});

describe('CU-11 / CU-12 · Buscar, ordenar y «Cerca de mí»', () => {
  test('busca con 3 letras o más y, sin coincidencias, sugiere categorías (A1)', async () => {
    const { llamadas } = await abrirComo(usuarioAndres, '/consumidor', {
      'GET /productos?pagina=1&tamano=20': () => [200, { productos: [productoApi()], pagina: 1, tamano: 20, total: 1, hayMas: false }],
      'GET /productos?q=aguacate&pagina=1&tamano=20': () => [200, { productos: [], pagina: 1, tamano: 20, total: 0, hayMas: false, sugerencias: ['FRUTAS', 'HORTALIZAS'] }],
    });
    await screen.findByText('Papa pastusa');
    await escribir('Buscar productos', 'ag');
    await pulsar('Buscar');
    expect(await screen.findByText('Escriba al menos 3 letras.')).toBeTruthy();
    await escribir('Buscar productos', 'aguacate');
    await pulsar('Buscar');
    expect(await screen.findByText(/No encontramos «aguacate»/)).toBeTruthy();
    expect(await screen.findByTestId('sugerencias')).toHaveTextContent(/Frutas/);
    expect(llamadas.map((l) => l.clave)).toContain('GET /productos?q=aguacate&pagina=1&tamano=20');
  });

  test('«Cerca de mí» envía la ubicación del teléfono y muestra la distancia; sin permiso usa el perfil (A1)', async () => {
    const cerca = () => [200, { productos: [productoApi({ distanciaKm: 8.4 })], pagina: 1, tamano: 20, total: 1, hayMas: false, ubicacion: { origen: 'TELEFONO' } }];
    const { llamadas } = await abrirComo(usuarioAndres, '/consumidor', {
      'GET /productos?pagina=1&tamano=20': () => [200, { productos: [productoApi()], pagina: 1, tamano: 20, total: 1, hayMas: false }],
      'GET /productos': cerca,
    });
    await screen.findByText('Papa pastusa');
    await pulsar('Orden: Más recientes');
    await fireEvent.press(await screen.findByText(/Cerca de mí/));
    expect(await screen.findByText(/8,4 km/)).toBeTruthy();
    expect(llamadas.map((l) => l.clave)).toContain('GET /productos?orden=cercania&pagina=1&tamano=20&lat=7.3756&lon=-72.6478');

    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await pulsar(/^Orden: /);
    await fireEvent.press(await screen.findByText(/Precio: menor a mayor/));
    await pulsar(/^Orden: /);
    await fireEvent.press(await screen.findByText(/Cerca de mí/));
    expect(await screen.findByTestId('aviso-ubicacion')).toHaveTextContent(/municipio de su perfil/);
  });
});

describe('CU-10 · Pausar y retirar una publicación', () => {
  test('pausa la publicación y, al retirar con pedidos en curso, informa que solo se puede pausar (A1)', async () => {
    const papa = productoApi({ productor: { id: 'u-rosa', nombre: 'Rosa P.', verificado: false, calificacion: { promedio: null, total: 0 } } });
    const { llamadas } = await abrirComo(usuarioRosa, '/productor/editar/p-papa', {
      'GET /productos/p-papa': () => [200, { producto: papa }],
      'PATCH /productos/p-papa/estado': ({ cuerpo }) => (cuerpo.accion === 'PAUSAR'
        ? [200, { producto: { ...papa, estado: 'PAUSADA', version: 2 } }]
        : [409, { error: { codigo: 'PEDIDOS_EN_CURSO', mensaje: 'Tiene un pedido en curso con este producto. Puede pausarla ahora y retirarla cuando se entreguen.', detalles: { pedidos: 1 } } }]),
    });
    await pulsar('⏸ Pausar publicación');
    expect(await screen.findByTestId('aviso-editar')).toHaveTextContent(/pausada/);
    expect(await screen.findByRole('button', { name: '▶ Reactivar publicación' })).toBeTruthy();
    await pulsar('🗑 Retirar publicación');
    await pulsar('Sí, retirar');
    expect(await screen.findByTestId('aviso-editar')).toHaveTextContent(/pedido en curso/);
    expect(llamadas.filter((l) => l.clave === 'PATCH /productos/p-papa/estado').map((l) => l.cuerpo)).toEqual([
      { accion: 'PAUSAR', version: 1 }, { accion: 'RETIRAR', version: 2 },
    ]);
  });
});

describe('CU-14 / CU-15 · Cancelar e historial', () => {
  test('el consumidor cancela con un motivo de la lista', async () => {
    const { llamadas } = await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1a2b3c4d', {
      'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: pedidoApi() }],
      'POST /pedidos/ped-1a2b3c4d/cancelar': () => [200, { pedido: pedidoApi({ estado: 'CANCELADO', motivoCancelacion: 'Consumidor: Ya no lo necesito', acciones: ['REPORTAR'] }), reembolsoPendiente: false }],
    });
    await pulsar('Cancelar pedido');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Ya no lo necesito' }));
    await pulsar('Sí, cancelar el pedido');
    expect(await screen.findByTestId('aviso-pedido')).toHaveTextContent(/Pedido cancelado/);
    expect(llamadas.find((l) => l.clave === 'POST /pedidos/ped-1a2b3c4d/cancelar').cuerpo).toEqual({ motivo: 'Ya no lo necesito', version: 2 });
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).toBeNull();
  });

  test('«Mis pedidos» filtra finalizados y por periodo; sin pedidos ofrece ir al catálogo (A1)', async () => {
    const { llamadas } = await abrirComo(usuarioAndres, '/consumidor/pedidos', {
      'GET /pedidos?estado=activos': () => [200, { pedidos: [] }],
      'GET /pedidos': () => [200, { pedidos: [pedidoApi({ estado: 'ENTREGADO' })] }],
    });
    expect(await screen.findByRole('button', { name: '🛒 Ir al catálogo' })).toBeTruthy();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Finalizados' }));
    expect(await screen.findByText(/Rosa P\./)).toBeTruthy();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Últimos 30 días' }));
    await waitFor(() => expect(llamadas.map((l) => l.clave).some((c) => /^GET \/pedidos\?estado=finalizados&desde=\d{4}-\d{2}-\d{2}$/.test(c))).toBe(true));
  });
});

describe('CU-19 · Reportar', () => {
  test('con «Otro» exige descripción (A2); sin señal el reporte queda en la cola (A3)', async () => {
    await abrirComo(usuarioAndres, '/consumidor/pedido/ped-1a2b3c4d', { 'GET /pedidos/ped-1a2b3c4d': () => [200, { pedido: pedidoApi({ estado: 'ENTREGADO', acciones: ['REPORTAR', 'CALIFICAR'] }) }] });
    await pulsar('Reportar un problema con este pedido');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Otro' }));
    await pulsar('Enviar reporte');
    expect(await screen.findByText('Cuéntenos qué pasó (mínimo 10 caracteres).')).toBeTruthy();
    await escribir('Cuéntenos qué pasó', 'Llegaron 30 kg y no 50 kg');
    global.__red.desconectar();
    await pulsar('Enviar reporte');
    expect(await screen.findByTestId('aviso-reporte')).toHaveTextContent(/guardado en el teléfono/);
  });
});

describe('CU-18 · Panel de administración', () => {
  test('el administrador ve el resumen, abre un reporte y oculta la publicación', async () => {
    const reporte = { id: 'r1', tipoContenido: 'PRODUCTO', idContenido: 'p-papa', motivo: 'PRECIO_ABUSIVO', motivoTexto: 'Precio abusivo', descripcion: 'Muy caro', estado: 'EN_REVISION', fecha: '2026-11-10T10:00:00Z' };
    const historial = { reportesRecibidos: 1, reportesConfirmados: 0, pedidosEnCurso: 0, pedidosCancelados: 0, pedidosEntregados: 3, calificacion: null, reportesHechos: 0, reportesMalintencionados: 0 };
    const persona = (u) => ({ ...u, estado: 'ACTIVA', fechaRegistro: '2026-10-01T10:00:00Z', historial });
    const { llamadas, getPathname } = await abrirComo(usuarioAdmin, null, {
      'GET /admin/resumen': () => [200, { reportesAbiertos: 1, productoresPorVerificar: 2, cuentasSuspendidas: 0, supresionesEnTramite: 0, productores: 4, consumidores: 2, publicacionesActivas: 7, pedidosEnCurso: 3 }],
      'GET /admin/reportes?estado=abiertos': () => [200, { reportes: [{ ...reporte, reportante: 'Andrés Contreras', reportado: 'Rosa Peñaranda', reportesDelContenido: 1 }] }],
      'GET /admin/reportes/r1': () => [200, { reporte, contenido: { tipo: 'PRODUCTO', nombre: 'Papa pastusa', precio: 85000, unidad: 'bulto', municipio: 'Pamplonita', estado: 'ACTIVA' }, reportado: persona(usuarioRosa), reportante: persona(usuarioAndres), decisionesPosibles: ['DESESTIMAR', 'OCULTAR', 'SUSPENDER'] }],
      'POST /admin/reportes/r1/resolver': () => [200, { reporte: { ...reporte, estado: 'RESUELTO', decision: 'OCULTAR', resolucion: 'Precio fuera de mercado.' }, reportesCerrados: 1, pedidosCancelados: 0 }],
    });
    await waitFor(() => expect(getPathname()).toBe('/administrador'));
    expect(await screen.findByTestId('resumen-admin')).toBeTruthy();
    await pulsar(/^Reportes/);
    await pulsar(/^Reporte de Publicación: Precio abusivo/);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Ocultar contenido' }));
    await escribir('Explicación para los usuarios', 'Precio fuera de mercado.');
    await pulsar('Registrar decisión');
    expect(await screen.findByTestId('aviso-reporte-admin')).toHaveTextContent(/Decisión registrada/);
    expect(llamadas.find((l) => l.clave === 'POST /admin/reportes/r1/resolver').cuerpo).toEqual({ decision: 'OCULTAR', resolucion: 'Precio fuera de mercado.', malintencionado: false, confirmar: false });
  });
});
