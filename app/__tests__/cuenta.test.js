import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import { establecerToken } from '../src/api/cliente';
import { apiFalsa, sesionDe, usuarioAndres } from './apiFalsa';

beforeEach(() => {
  global.__almacenSeguro?.clear();
  establecerToken(null);
});

async function abrirEn(ruta) {
  const render = renderRouter('./src/app', { initialUrl: ruta });
  await render;
  await waitFor(() => expect(screen.queryByLabelText('Cargando')).toBeNull());
  return { getPathname: () => render.getPathname() };
}

const escribir = (etiqueta, texto) => fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
const pulsar = async (nombre) => fireEvent.press(screen.getByRole('button', { name: nombre }));

describe('CU-21 · Iniciar sesión', () => {
  test('CA-02: credenciales inválidas muestran el mensaje genérico y limpian la contraseña', async () => {
    apiFalsa({ 'POST /auth/sesion': () => [401, { error: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales inválidas.' } }] });
    const app = await abrirEn('/iniciar-sesion');
    await escribir('Correo o celular', 'rosa@correo.co');
    await escribir('Contraseña', 'mala12345');
    await pulsar('Ingresar');
    expect(await screen.findByTestId('error-sesion')).toHaveTextContent(/Credenciales inválidas\./);
    expect(screen.getByLabelText('Contraseña').props.value).toBe('');
    expect(app.getPathname()).toBe('/iniciar-sesion');
  });

  test('CP-02: cuenta bloqueada informa la hora en que puede volver a intentar', async () => {
    const hasta = new Date(2026, 9, 11, 10, 45);
    apiFalsa({
      'POST /auth/sesion': () => [423, { error: { codigo: 'CUENTA_BLOQUEADA', mensaje: 'Cuenta bloqueada temporalmente por intentos fallidos.', detalles: { bloqueadoHasta: hasta.toISOString() } } }],
    });
    await abrirEn('/iniciar-sesion');
    await escribir('Correo o celular', '3105551234');
    await escribir('Contraseña', 'cosecha2026');
    await pulsar('Ingresar');
    expect(await screen.findByTestId('error-sesion')).toHaveTextContent(/a las 10:45/);
  });

  test('campos vacíos se marcan sin llamar al servidor', async () => {
    const llamadas = apiFalsa();
    await abrirEn('/iniciar-sesion');
    await pulsar('Ingresar');
    expect(screen.getByText('Escriba su correo o celular.')).toBeTruthy();
    expect(llamadas.some((l) => l.clave === 'POST /auth/sesion')).toBe(false);
  });

  test('sin red informa que necesita señal y conserva lo escrito (A4)', async () => {
    apiFalsa({ 'POST /auth/sesion': () => 'SIN_RED' });
    await abrirEn('/iniciar-sesion');
    await escribir('Correo o celular', 'rosa@correo.co');
    await escribir('Contraseña', 'cosecha2026');
    await pulsar('Ingresar');
    expect(await screen.findByTestId('error-sesion')).toHaveTextContent(/Necesita señal/);
    expect(screen.getByLabelText('Correo o celular').props.value).toBe('rosa@correo.co');
  });
});

async function llenarRegistro() {
  await pulsar('Compro productos, Soy consumidor');
  await escribir('Nombres', 'Andrés');
  await escribir('Apellidos', 'Contreras');
  await escribir('Celular', '320 555 0000');
  await escribir('Correo', 'andres@correo.co');
  await pulsar('Elegir municipio');
  await fireEvent.changeText(screen.getByLabelText('Buscar municipio'), 'cucu');
  await pulsar('Cúcuta');
  await escribir('Contraseña', 'mercado2026');
}

describe('CU-01 · Registrarse', () => {
  test('CP-01: crea la cuenta de consumidor y abre su pantalla principal', async () => {
    const llamadas = apiFalsa({ 'POST /auth/registro': () => [201, sesionDe(usuarioAndres)] });
    const app = await abrirEn('/registro');
    await llenarRegistro();
    await fireEvent.press(screen.getByTestId('casilla-autorizacion'));
    await pulsar('Crear cuenta');

    await waitFor(() => expect(app.getPathname()).toBe('/consumidor'));
    const { cuerpo } = llamadas.find((l) => l.clave === 'POST /auth/registro');
    expect(cuerpo).toMatchObject({
      rol: 'CONSUMIDOR', nombres: 'Andrés', telefono: '3205550000', municipio: 'Cúcuta', aceptaTratamientoDatos: true,
    });
  });

  test('A3: sin aceptar la autorización no envía nada', async () => {
    const llamadas = apiFalsa();
    await abrirEn('/registro');
    await llenarRegistro();
    await pulsar('Crear cuenta');
    expect(screen.getByText('Debe aceptar el tratamiento de datos para crear la cuenta.')).toBeTruthy();
    expect(llamadas.some((l) => l.clave === 'POST /auth/registro')).toBe(false);
  });

  test('A1: correo ya registrado marca el campo y ofrece iniciar sesión', async () => {
    apiFalsa({
      'POST /auth/registro': () => [409, { error: { codigo: 'CUENTA_EXISTENTE', mensaje: 'Ya existe una cuenta con ese correo. Inicie sesión.', detalles: { campo: 'correo' } } }],
    });
    const app = await abrirEn('/registro');
    await llenarRegistro();
    await fireEvent.press(screen.getByTestId('casilla-autorizacion'));
    await pulsar('Crear cuenta');
    expect(await screen.findByTestId('error-registro')).toHaveTextContent(/Ya existe una cuenta con ese correo/);
    await pulsar('Ir a iniciar sesión');
    await waitFor(() => expect(app.getPathname()).toBe('/iniciar-sesion'));
  });
});
