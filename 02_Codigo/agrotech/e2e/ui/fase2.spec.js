// Fase 2 del SRS (v1.1.0) · Pruebas de interfaz con evidencias (capturas por paso en resultados/capturas/)
const crypto = require('node:crypto');
const {
  test, expect, entrar, evidencia,
} = require('./ayudas');
const {
  auth, json, uuid, crearCuenta, publicar, pedir, entregar, aceptar, codigoRecuperacion, BUZON, ADMIN,
} = require('../soporte/api');

const marca = () => crypto.randomBytes(3).toString('hex');
const primerPedido = async (r) => (await json(r)).pedidos[0];

async function entrarCon(page, identificador, contrasena) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo o celular').fill(identificador);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(contrasena);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test('CP-20 (UI): recuperar la contraseña con el código del correo y entrar con la nueva', { tag: '@CP-20' }, async ({ page, api }) => {
  test.skip(!BUZON, 'Requiere el buzón de correo de la API local.');
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('button', { name: '¿Olvidó su contraseña?' }).click();
  await page.getByLabel('Correo', { exact: true }).fill(rosa.correo);
  await evidencia(page, 'solicitar codigo');
  const desde = Date.now() - 1000;
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByTestId('aviso-recuperar')).toContainText('Si el correo está registrado');
  const codigo = await codigoRecuperacion(rosa.correo, { desde });
  await page.getByLabel('Código de 6 dígitos').fill(codigo === '000000' ? '111111' : '000000');
  await page.getByRole('textbox', { name: 'Nueva contraseña', exact: true }).fill('nuevaClave2026');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByTestId('aviso-recuperar')).toContainText('Le quedan 2 intento');
  await evidencia(page, 'codigo errado intentos restantes');
  await page.getByLabel('Código de 6 dígitos').fill(codigo);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await evidencia(page, 'sesion abierta con la nueva contrasena');
  expect((await api.get('auth/yo', { headers: auth(rosa.token) })).status()).toBe(401);
});

test('CP-21 (UI): editar el perfil; el celular de otra cuenta se marca en el campo', { tag: '@CP-21' }, async ({ page, api }) => {
  const andres = await crearCuenta(api, { municipio: 'Cúcuta', nombres: 'Andres' });
  const otra = await crearCuenta(api);
  await entrar(page, andres.correo);
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await evidencia(page, 'mi cuenta');
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await page.getByLabel('Celular').fill(otra.telefono);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Ese celular ya pertenece a otra cuenta.')).toBeVisible();
  await evidencia(page, 'celular en uso rechazado');
  await page.getByLabel('Celular').fill(andres.telefono);
  await page.getByLabel('Vereda o dirección (opcional)').fill('Barrio La Libertad, calle 5');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByTestId('aviso-perfil')).toContainText('Datos guardados');
  await evidencia(page, 'perfil guardado');
  expect((await json(await api.get('perfil', { headers: auth(andres.token) }))).perfil.veredaDireccion).toBe('Barrio La Libertad, calle 5');
});

test('CP-22 (UI): consultar mis datos y pedir que los borren; la sesión se cierra', { tag: '@CP-22' }, async ({ page, api }) => {
  const maria = await crearCuenta(api, { nombres: 'Maria' });
  await entrar(page, maria.correo);
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await page.getByRole('button', { name: 'Privacidad y datos' }).click();
  await expect(page.getByTestId('mis-datos')).toContainText(maria.correo);
  await expect(page.getByTestId('autorizacion').first()).toContainText('Aviso de privacidad versión');
  await evidencia(page, 'datos y autorizacion');
  await page.getByRole('button', { name: 'Solicitar que borren mis datos' }).click();
  await expect(page.getByTestId('confirmar-supresion')).toContainText('se conservan sin su identificación');
  await evidencia(page, 'consecuencias de la supresion');
  await page.getByRole('button', { name: 'Sí, borrar mis datos' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible({ timeout: 15_000 });
  await evidencia(page, 'sesion cerrada tras la supresion');
  expect((await api.post('auth/sesion', { data: { identificador: maria.correo, contrasena: 'cosecha2026' } })).status()).toBe(401);
});

test('CP-23 (UI): pausar y reactivar una publicación desde «Mis productos»', { tag: '@CP-23' }, async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const nombre = `Mora ${marca()}`;
  await publicar(api, rosa.token, { nombre, categoria: 'FRUTAS', unidad: 'kg', precio: 4500, stock: 8 }, 'platano');
  await entrar(page, rosa.correo);
  await page.getByRole('button', { name: /^Mis productos/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
  await evidencia(page, 'estado de la publicacion');
  await page.getByRole('button', { name: '⏸ Pausar publicación' }).click();
  await expect(page.getByTestId('aviso-editar')).toContainText('pausada');
  await evidencia(page, 'publicacion pausada');
  const comprador = await crearCuenta(api);
  expect((await json(await api.get(`productos?q=${encodeURIComponent(nombre)}`, { headers: auth(comprador.token) }))).total).toBe(0);
  await page.getByRole('button', { name: '▶ Reactivar publicación' }).click();
  await expect(page.getByTestId('aviso-editar')).toContainText('reactivada');
  await page.getByRole('button', { name: '🗑 Retirar publicación' }).click();
  await expect(page.getByTestId('confirmar-retiro')).toBeVisible();
  await evidencia(page, 'confirmar retiro');
});

test('CP-24 (UI): buscar sin tildes, ordenar por precio y recibir sugerencias', { tag: '@CP-24' }, async ({ page, api }) => {
  const m = marca();
  const luis = await crearCuenta(api, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
  await publicar(api, luis.token, { nombre: `Café ${m} especial`, categoria: 'CAFE_CACAO', unidad: 'kg', precio: 22000, municipio: 'Ocaña' });
  await publicar(api, luis.token, { nombre: `Cebolla ${m}`, descripcion: `Ideal con un CAFÉ ${m}`, categoria: 'HORTALIZAS', unidad: 'kg', precio: 2500, municipio: 'Ocaña' }, 'cebolla');
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await page.getByLabel('Buscar productos').fill(`cafe ${m}`);
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const tarjetas = page.getByRole('button', { name: / disponibles, / });
  await expect(tarjetas).toHaveCount(2, { timeout: 15_000 });
  test.info().annotations.push({ type: 'medición', description: `Resultados de la búsqueda visibles en ${Date.now() - t0} ms` });
  await evidencia(page, 'busqueda sin tildes');
  await page.getByRole('button', { name: /^Orden: / }).click();
  await page.getByRole('button', { name: 'Precio: menor a mayor' }).click();
  await expect(tarjetas.first()).toHaveAccessibleName(new RegExp(`^Cebolla ${m}`));
  await evidencia(page, 'ordenado por precio');
  await page.getByLabel('Buscar productos').fill(`zzz${m}`);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByTestId('sugerencias')).toBeVisible();
  await evidencia(page, 'sin resultados con sugerencias');
});

test.describe('CU-12 con la ubicación del teléfono (Ocaña)', () => {
  test.use({ geolocation: { latitude: 8.24, longitude: -73.35 }, permissions: ['geolocation'] });

  test('CP-25 (UI): «Cerca de mí» muestra primero lo más cercano con los km y filtra por radio', { tag: '@CP-25' }, async ({ page, api }) => {
    const m = marca();
    const ocana = await crearCuenta(api, { rol: 'PRODUCTOR', municipio: 'Ocaña' });
    const pamplona = await crearCuenta(api, { rol: 'PRODUCTOR', municipio: 'Pamplona' });
    await publicar(api, pamplona.token, { nombre: `Tomate ${m} de Pamplona`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Pamplona' }, 'cebolla');
    await publicar(api, ocana.token, { nombre: `Tomate ${m} de Ocaña`, categoria: 'HORTALIZAS', unidad: 'kg', municipio: 'Ocaña' }, 'cebolla');
    const andres = await crearCuenta(api, { municipio: 'Pamplona' });
    await entrar(page, andres.correo);
    await page.getByLabel('Buscar productos').fill(`tomate ${m}`);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    const tarjetas = page.getByRole('button', { name: / disponibles, / });
    await expect(tarjetas).toHaveCount(2, { timeout: 15_000 });
    await page.getByRole('button', { name: /^Orden: / }).click();
    await page.getByRole('button', { name: 'Cerca de mí' }).click();
    await expect(page.getByTestId('origen-cercania')).toContainText('su ubicación actual');
    await expect(tarjetas.first()).toHaveAccessibleName(new RegExp(`^Tomate ${m} de Ocaña.*, a [\\d,]+ km`));
    await evidencia(page, 'ordenado por cercania');
    await page.getByRole('button', { name: /^Radio: / }).click();
    await page.getByRole('button', { name: 'Hasta 25 km' }).click();
    await expect(tarjetas).toHaveCount(1);
    await evidencia(page, 'radio de 25 km');
  });
});

test('CP-26 (UI): el consumidor cancela un pedido aceptado y el productor recibe el aviso', { tag: '@CP-26' }, async ({ page, otraPagina, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(api, { nombres: 'Andres' });
  const papa = await publicar(api, rosa.token, { stock: 20 });
  const pedido = await aceptar(api, rosa.token, await primerPedido(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 3 }])));
  await Promise.all([entrar(page, andres.correo), entrar(otraPagina, rosa.correo)]);
  await expect(otraPagina.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Mis pedidos' }).click();
  await page.getByRole('button', { name: /^Pedido de Rosa.*Aceptado/ }).click();
  await page.getByRole('button', { name: 'Cancelar pedido' }).click();
  await page.getByRole('radio', { name: 'Ya no lo necesito' }).click();
  await evidencia(page, 'motivo de cancelacion');
  await page.getByRole('button', { name: 'Sí, cancelar el pedido' }).click();
  await expect(page.getByTestId('aviso-pedido')).toContainText('Pedido cancelado');
  await evidencia(page, 'pedido cancelado');
  // El productor ya tenía el aviso del pedido nuevo; la cancelación suma el segundo, en vivo (WebSocket).
  await expect(otraPagina.getByRole('button', { name: 'Avisos, 2 sin leer' })).toBeVisible({ timeout: 15_000 });
  await evidencia(otraPagina, 'aviso al productor');
  expect((await json(await api.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto.stock).toBe(20);
  expect(pedido.estado).toBe('ACEPTADO');
});

test('CP-27 (UI): «Mis pedidos» separa activos y finalizados y filtra por periodo', { tag: '@CP-27' }, async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(api);
  const papa = await publicar(api, rosa.token, { stock: 20 });
  await entregar(api, rosa.token, await primerPedido(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 1 }])));
  const p2 = await primerPedido(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 2 }]));
  await api.post(`pedidos/${p2.id}/cancelar`, { headers: auth(andres.token), data: { motivo: 'Me equivoqué' } });
  await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 3 }]);
  await entrar(page, andres.correo);
  await page.getByRole('button', { name: 'Mis pedidos' }).click();
  await expect(page.getByRole('button', { name: /^Pedido de / })).toHaveCount(1, { timeout: 15_000 });
  await evidencia(page, 'activos');
  await page.getByRole('radio', { name: 'Finalizados' }).click();
  await expect(page.getByRole('button', { name: /^Pedido de / })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Cancelado/ })).toHaveCount(1);
  await evidencia(page, 'finalizados');
  await page.getByRole('radio', { name: 'Todos' }).click();
  await page.getByRole('radio', { name: 'Últimos 7 días' }).click();
  await expect(page.getByRole('button', { name: /^Pedido de / })).toHaveCount(3);
  await evidencia(page, 'todos de los ultimos 7 dias');
});

test('CP-28 (UI): los avisos quedan en la bandeja y el del mensaje abre el chat', { tag: '@CP-28' }, async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(api, { nombres: 'Andres' });
  const papa = await publicar(api, rosa.token, { stock: 20 });
  const p = await primerPedido(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 1 }]));
  await entrar(page, andres.correo);
  await expect(page.getByRole('button', { name: 'Mi cuenta' })).toBeVisible({ timeout: 15_000 });
  await aceptar(api, rosa.token, p);
  await api.post(`pedidos/${p.id}/mensajes`, { headers: auth(rosa.token), data: { id: uuid(), contenido: 'Le llevo la papa mañana a las 9' } });
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await expect(page.getByRole('button', { name: 'Avisos, 2 sin leer' })).toBeVisible({ timeout: 15_000 });
  await evidencia(page, 'contador de avisos');
  await page.getByRole('button', { name: 'Avisos, 2 sin leer' }).click();
  await expect(page.getByRole('button', { name: /Pedido aceptado/ })).toBeVisible();
  await evidencia(page, 'bandeja de avisos');
  await page.getByRole('button', { name: /Le llevo la papa/ }).click();
  await expect(page.getByLabel('Escriba un mensaje')).toBeVisible({ timeout: 15_000 });
  await evidencia(page, 'el aviso abre el chat');
});

test('CP-29 (UI): reportar una publicación; «Otro» exige descripción y el repetido queda en trámite', { tag: '@CP-29' }, async ({ page, api }) => {
  const nombre = `Papa ${marca()}`;
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR' });
  await publicar(api, rosa.token, { nombre });
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await page.getByLabel('Buscar productos').fill(nombre);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
  await page.getByRole('button', { name: 'Reportar esta publicación' }).click();
  await page.getByRole('radio', { name: 'Otro' }).click();
  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(page.getByText('Cuéntenos qué pasó (mínimo 10 caracteres).')).toBeVisible();
  await evidencia(page, 'otro exige descripcion');
  await page.getByRole('radio', { name: 'Precio abusivo' }).click();
  await page.getByLabel('Detalles (opcional)').fill('El bulto está al doble del precio de la plaza.');
  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(page.getByTestId('aviso-reporte')).toContainText('Recibimos su reporte');
  await evidencia(page, 'reporte recibido');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Reportar esta publicación' }).click();
  await page.getByRole('radio', { name: 'Publicación engañosa' }).click();
  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(page.getByTestId('aviso-reporte')).toContainText('en trámite');
  await evidencia(page, 'reporte repetido en tramite');
});

test('CP-30 (UI): el administrador revisa el reporte en el panel web y oculta la publicación', { tag: '@CP-30' }, async ({ page, api }) => {
  const nombre = `Cebolla ${marca()}`;
  const luis = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Luis' });
  const producto = await publicar(api, luis.token, { nombre, categoria: 'HORTALIZAS', unidad: 'arroba' }, 'cebolla');
  const andres = await crearCuenta(api);
  await api.post('reportes', { headers: auth(andres.token), data: { tipoContenido: 'PRODUCTO', idContenido: producto.id, motivo: 'PUBLICACION_ENGANOSA', descripcion: `La foto de ${nombre} no corresponde` } });
  await page.setViewportSize({ width: 1280, height: 900 }); // panel web en un computador
  await entrarCon(page, ADMIN.correo, ADMIN.contrasena);
  await expect(page.getByTestId('resumen-admin')).toBeVisible({ timeout: 15_000 });
  await evidencia(page, 'panel de administracion');
  await page.getByRole('button', { name: /^Reportes/ }).click();
  await page.getByRole('button', { name: new RegExp(`^Reporte de Publicación: Publicación engañosa, contra Luis`) }).last().click();
  await expect(page.getByTestId('contenido-producto')).toContainText(nombre);
  await evidencia(page, 'reporte con contenido e historial');
  await page.getByRole('radio', { name: 'Ocultar contenido' }).click();
  await page.getByLabel('Explicación para los usuarios').fill('La foto no corresponde al producto publicado.');
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByTestId('aviso-reporte-admin')).toContainText('Decisión registrada');
  await evidencia(page, 'decision registrada');
  expect((await api.get(`productos/${producto.id}`, { headers: auth(andres.token) })).status()).toBe(404);
  await page.goBack();
  await page.goBack();
  await page.getByRole('button', { name: /^Bitácora/ }).click();
  await expect(page.getByText(/MODERACION_OCULTAR/).first()).toBeVisible();
  await evidencia(page, 'bitacora de auditoria');
});
