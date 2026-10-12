import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import { establecerToken } from '../src/api/cliente';
import { apiFalsa, sesionDe, usuarioAndres, usuarioRosa } from './apiFalsa';

const CLAVE = 'agrotech.sesion';
const almacen = () => global.__almacenSeguro;

beforeEach(() => {
  almacen()?.clear();
  establecerToken(null);
});

// renderRouter devuelve una promesa (RNTL 14) a la que expo-router agrega getPathname().
async function abrirApp() {
  const render = renderRouter('./src/app', { initialUrl: '/' });
  await render;
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  return { getPathname: () => render.getPathname() };
}

async function entrarComo(usuario) {
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await fireEvent.changeText(await screen.findByLabelText('Correo o celular'), usuario.correo);
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'cosecha2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('Navegación por rol con sesión real (AGRO-3 · AGRO-5)', () => {
  test('sin sesión se muestra la bienvenida', async () => {
    apiFalsa();
    const app = await abrirApp();
    expect(app.getPathname()).toBe('/');
    expect(screen.getByText('Crear cuenta')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('estado-servidor')).toHaveTextContent('Servidor: conectado · migración 001'));
  });

  test('el productor inicia sesión, llega a sus accesos y el token queda en el almacén seguro', async () => {
    const llamadas = apiFalsa({ 'POST /auth/sesion': () => [200, sesionDe(usuarioRosa)] });
    const app = await abrirApp();
    await entrarComo(usuarioRosa);
    await waitFor(() => expect(app.getPathname()).toBe('/productor'));
    expect(screen.getByText('Hola, Rosa')).toBeTruthy();
    for (const t of ['Publicar producto', 'Mis productos', 'Mis pedidos', 'Mis ventas', 'Mensajes']) expect(screen.getByText(t)).toBeTruthy();

    const login = llamadas.find((l) => l.clave === 'POST /auth/sesion');
    expect(login.cuerpo).toEqual({ identificador: 'rosa@correo.co', contrasena: 'cosecha2026' });
    expect(JSON.parse(almacen().get(CLAVE)).token).toBe('jwt-u-rosa');
  });

  test('publicar está a un toque desde el inicio del productor', async () => {
    apiFalsa({ 'POST /auth/sesion': () => [200, sesionDe(usuarioRosa)] });
    const app = await abrirApp();
    await entrarComo(usuarioRosa);
    await fireEvent.press(await screen.findByLabelText('Publicar producto'));
    await waitFor(() => expect(app.getPathname()).toBe('/productor/publicar'));
  });

  test('el consumidor llega al catálogo y no ve rutas del productor', async () => {
    apiFalsa({ 'POST /auth/sesion': () => [200, sesionDe(usuarioAndres)], 'GET /productos?pagina=1&tamano=20': () => [200, { productos: [], pagina: 1, tamano: 20, total: 0, hayMas: false }] });
    const app = await abrirApp();
    await entrarComo(usuarioAndres);
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor'));
    expect(await screen.findByLabelText('Filtro Municipio')).toBeTruthy();
    expect(screen.queryByText('Mis ventas')).toBeNull();
  });

  test('al cerrar sesión vuelve a la bienvenida y borra el token', async () => {
    apiFalsa({ 'POST /auth/sesion': () => [200, sesionDe(usuarioRosa)] });
    const app = await abrirApp();
    await entrarComo(usuarioRosa);
    await fireEvent.press(await screen.findByText('Cerrar sesión'));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(almacen().has(CLAVE)).toBe(false);
  });
});

describe('Restaurar la sesión al abrir la app', () => {
  test('con sesión guardada entra directo y la valida con /auth/yo enviando el token', async () => {
    almacen().set(CLAVE, JSON.stringify(sesionDe(usuarioRosa)));
    const llamadas = apiFalsa({ 'GET /auth/yo': () => [200, { usuario: { ...usuarioRosa, nombres: 'Rosa Elena' } }] });
    const app = await abrirApp();
    expect(app.getPathname()).toBe('/productor');
    await waitFor(() => expect(screen.getByText('Hola, Rosa Elena')).toBeTruthy());
    const yo = llamadas.find((l) => l.clave === 'GET /auth/yo');
    expect(yo.cabeceras.Authorization).toBe('Bearer jwt-u-rosa');
  });

  test('si el servidor rechaza el token vuelve a la bienvenida', async () => {
    almacen().set(CLAVE, JSON.stringify(sesionDe(usuarioRosa)));
    apiFalsa({ 'GET /auth/yo': () => [401, { error: { codigo: 'SESION_EXPIRADA', mensaje: 'La sesión expiró.' } }] });
    const app = await abrirApp();
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(almacen().has(CLAVE)).toBe(false);
  });

  test('sin señal conserva la sesión guardada (uso rural, RF-17)', async () => {
    almacen().set(CLAVE, JSON.stringify(sesionDe(usuarioRosa)));
    apiFalsa({ 'GET /auth/yo': () => 'SIN_RED' });
    const app = await abrirApp();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(app.getPathname()).toBe('/productor');
    expect(screen.getByText('Hola, Rosa')).toBeTruthy();
  });

  test('una sesión vencida se descarta sin consultar al servidor', async () => {
    almacen().set(CLAVE, JSON.stringify({ ...sesionDe(usuarioRosa), expiraEn: '2020-01-01T00:00:00.000Z' }));
    const llamadas = apiFalsa();
    const app = await abrirApp();
    expect(app.getPathname()).toBe('/');
    expect(llamadas.some((l) => l.clave === 'GET /auth/yo')).toBe(false);
  });
});
