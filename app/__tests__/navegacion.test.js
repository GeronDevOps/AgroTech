import { renderRouter, screen, fireEvent, waitFor, act } from 'expo-router/testing-library';

// La bienvenida consulta /salud: se simula una API disponible.
beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ estado: 'ok', baseDeDatos: { migracion: '001' } }),
  }));
});

// renderRouter devuelve una promesa (RNTL 14) a la que expo-router agrega getPathname().
async function abrirApp() {
  const render = renderRouter('./src/app');
  await render;
  await waitFor(() => expect(screen.getByText('AgroTech')).toBeTruthy());
  return { getPathname: () => render.getPathname() };
}

describe('Navegación por rol (AGRO-3)', () => {
  test('sin sesión se muestra la bienvenida', async () => {
    const app = await abrirApp();
    expect(app.getPathname()).toBe('/');
    expect(screen.getByText('Iniciar sesión')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('estado-servidor')).toHaveTextContent('Servidor: conectado · migración 001'));
  });

  test('el productor llega a su inicio con los cuatro accesos', async () => {
    const app = await abrirApp();
    await act(async () => fireEvent.press(screen.getByText('Entrar como productor')));
    await waitFor(() => expect(app.getPathname()).toBe('/productor'));
    for (const t of ['Publicar producto', 'Mis pedidos', 'Mis ventas', 'Mensajes']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  test('publicar está a un toque desde el inicio del productor', async () => {
    const app = await abrirApp();
    await act(async () => fireEvent.press(screen.getByText('Entrar como productor')));
    await act(async () => fireEvent.press(await screen.findByLabelText('Publicar producto')));
    await waitFor(() => expect(app.getPathname()).toBe('/productor/publicar'));
  });

  test('el consumidor llega al catálogo y no puede abrir rutas del productor', async () => {
    const app = await abrirApp();
    await act(async () => fireEvent.press(screen.getByText('Entrar como consumidor')));
    await waitFor(() => expect(app.getPathname()).toBe('/consumidor'));
    expect(screen.getByText('Catálogo con filtros')).toBeTruthy();
    expect(screen.queryByText('Mis ventas')).toBeNull();
  });

  test('al cerrar sesión vuelve a la bienvenida', async () => {
    const app = await abrirApp();
    await act(async () => fireEvent.press(screen.getByText('Entrar como productor')));
    await act(async () => fireEvent.press(await screen.findByText('Cerrar sesión')));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
  });
});
