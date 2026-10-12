// Pruebas de interfaz: CU-05 chat (dos teléfonos), CU-06 calificar, CU-07 ventas, CU-15 mis pedidos, CU-17 conflicto
const { test, expect, entrar, red } = require('./ayudas');
const {
  auth, json, crearCuenta, publicar, pedir, cambiarEstado, entregar, percentil,
} = require('../soporte/api');

async function escenario(api, { cantidad = 2 } = {}) {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(api, { municipio: 'Cúcuta', nombres: 'Andres' });
  const papa = await publicar(api, rosa.token, { precio: 85000, stock: 40 });
  const [pedido] = (await json(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad }]))).pedidos;
  return { rosa, andres, papa, pedido };
}

/** Desde la pantalla de inicio del rol, abre «Mis pedidos» y luego el pedido indicado. */
async function abrirPedido(page, rol, contraparte, estado = /.*/) {
  const boton = rol === 'PRODUCTOR' ? /^Mis pedidos/ : 'Mis pedidos';
  await page.getByRole('button', { name: boton }).first().click();
  await page.getByRole('button', { name: new RegExp(`^Pedido de ${contraparte}.*${estado.source}`) }).first().click();
}

test('CP-09 (UI): el mensaje llega en tiempo real al otro teléfono con su hora', { tag: '@CP-09' }, async ({ page, otraPagina, api }) => {
  const { rosa, andres } = await escenario(api);
  await Promise.all([entrar(page, andres.correo), entrar(otraPagina, rosa.correo)]);
  await expect(otraPagina.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Mis pedidos' })).toBeVisible({ timeout: 15_000 });

  await abrirPedido(page, 'CONSUMIDOR', 'Rosa');
  await page.getByRole('button', { name: /^Chat con Rosa/ }).click();
  await abrirPedido(otraPagina, 'PRODUCTOR', 'Andres');
  await otraPagina.getByRole('button', { name: /^Chat con Andres/ }).click();
  await expect(otraPagina.getByLabel('Escriba un mensaje')).toBeVisible();

  const latencias = [];
  const conversacion = [
    [page, otraPagina, '¿Puede entregar mañana a las 9?'],
    [otraPagina, page, 'Sí, a las 9 en el parque principal.'],
    [page, otraPagina, 'Perfecto, gracias.'],
  ];
  for (const [emisor, receptor, texto] of conversacion) {
    await emisor.getByLabel('Escriba un mensaje').fill(texto);
    const inicio = Date.now();
    await emisor.getByRole('button', { name: 'Enviar' }).click();
    const burbuja = receptor.getByLabel(new RegExp(`, \\d{1,2}:\\d{2}.*: ${texto.replace(/[?¿]/g, '.')}`));
    await expect(burbuja).toBeVisible({ timeout: 10_000 });
    latencias.push(Date.now() - inicio);
  }
  // El primer mensaje de Andrés termina «Leído», porque Rosa tiene el chat abierto.
  await expect(page.getByText('✓✓ Leído').first()).toBeVisible({ timeout: 10_000 });
  test.info().annotations.push({ type: 'medición', description: `Mensaje visible en el otro teléfono: ${latencias.map((l) => `${l} ms`).join(' · ')} (p95 ${percentil(latencias, 95)} ms)` });
  expect(percentil(latencias, 95)).toBeLessThan(3000);
});

test('CP-10 (UI): calificar un pedido entregado; la segunda calificación no se guarda', { tag: '@CP-10' }, async ({ page, api }) => {
  const { rosa, andres, pedido } = await escenario(api);
  await entregar(api, rosa.token, pedido);
  await entrar(page, andres.correo);
  await page.getByRole('button', { name: 'Mis pedidos' }).click();
  await page.getByRole('radio', { name: 'Todos' }).click();
  await page.getByRole('button', { name: /^Pedido de Rosa.*Entregado/ }).click();

  await expect(page.getByTestId('calificar')).toBeVisible();
  await page.getByRole('radio', { name: '4 estrellas, Bueno' }).click();
  await page.getByLabel('Comentario (opcional)').fill('Buena papa, bien empacada.');
  await page.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(page.getByTestId('calificacion-hecha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar calificación' })).toHaveCount(0);

  // Segundo intento (p. ej. desde otro teléfono): 409 y se conserva la primera.
  const otra = await api.post(`pedidos/${pedido.id}/calificacion`, { headers: auth(andres.token), data: { puntuacion: 1 } });
  expect(otra.status()).toBe(409);
  expect((await json(otra)).error.codigo).toBe('YA_CALIFICADO');
  await page.reload(); // la app reabre en el inicio del rol: se vuelve al pedido
  await page.getByRole('button', { name: 'Mis pedidos' }).click();
  await page.getByRole('radio', { name: 'Todos' }).click();
  await page.getByRole('button', { name: /^Pedido de Rosa.*Entregado/ }).click();
  await expect(page.getByTestId('calificacion-hecha')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('calificacion-hecha')).toContainText('Buena papa');
});

test('CP-11 (UI): el panel muestra cifras iguales a la suma de los pedidos entregados', { tag: '@CP-11' }, async ({ page, api }) => {
  const { rosa, andres, papa, pedido } = await escenario(api); // 170.000
  const [p2] = (await json(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 1 }]))).pedidos; // 85.000
  const [enCurso] = (await json(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 4 }]))).pedidos; // 340.000, no cuenta
  await entregar(api, rosa.token, pedido);
  await entregar(api, rosa.token, p2);
  expect(enCurso.estado).toBe('PENDIENTE');

  await entrar(page, rosa.correo);
  await page.getByRole('button', { name: 'Mis ventas' }).click();
  await expect(page.getByTestId('kpi-ingresos')).toHaveAccessibleName('Ingresos del periodo: $ 255.000', { timeout: 15_000 });
  await expect(page.getByTestId('kpi-pedidos')).toHaveAccessibleName('Pedidos entregados: 2');
  await expect(page.getByTestId('kpi-promedio')).toHaveAccessibleName('Promedio por pedido: $ 127.500');
  await expect(page.getByLabel(/^1\. Papa pastusa: 3 bultos, \$ 255\.000, 2 pedidos/)).toBeVisible();
  await expect(page.getByTestId('en-curso')).toContainText('$ 340.000');
});

test('CP-14 (UI): «Mis pedidos» muestra los activos con su estado vigente y se actualiza en vivo', { tag: '@CP-14' }, async ({ page, api }) => {
  const { rosa, andres, papa, pedido: pendiente } = await escenario(api, { cantidad: 1 });
  const crear = async (n) => (await json(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: n }]))).pedidos[0];
  let aceptado = await crear(2);
  const entregado = await crear(3);
  aceptado = (await json(await cambiarEstado(api, rosa.token, aceptado, 'ACEPTADO'))).pedido;
  await entregar(api, rosa.token, entregado);

  await entrar(page, andres.correo);
  await page.getByRole('button', { name: 'Mis pedidos' }).click();
  await expect(page.getByRole('button', { name: /^Pedido de / })).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Pedido de Rosa.*Pendiente, total \$ 85\.000/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pedido de Rosa.*Aceptado, total \$ 170\.000/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Entregado/ })).toHaveCount(0);

  // El productor despacha: la tarjeta cambia sin recargar (tiempo real).
  await cambiarEstado(api, rosa.token, aceptado, 'EN_CAMINO');
  await expect(page.getByRole('button', { name: /^Pedido de Rosa.*En camino, total \$ 170\.000/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('radio', { name: 'Todos' }).click();
  await expect(page.getByRole('button', { name: /^Pedido de / })).toHaveCount(3);
  expect(pendiente.estado).toBe('PENDIENTE');
});

test('CP-17 (UI): editar sin conexión mientras cambia la versión → «Con error» y prevalece el servidor', { tag: '@CP-17' }, async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const papa = await publicar(api, rosa.token, { nombre: 'Papa pastusa', precio: 85000, stock: 20 });
  await entrar(page, rosa.correo);
  await expect(page.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000); // primera sincronización (copia local)

  await red(page, false);
  await page.getByRole('button', { name: /^Mis productos/ }).click();
  await page.getByRole('button', { name: /^Papa pastusa/ }).click();
  await page.getByLabel(/^Precio por/).fill('90000');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByTestId('aviso-editar')).toBeVisible();

  // Mientras tanto, otro teléfono de Rosa cambia el precio en el servidor.
  expect((await api.patch(`productos/${papa.id}`, { headers: auth(rosa.token), data: { precio: 95000, version: papa.version } })).status()).toBe(200);

  await red(page, true);
  await expect(page.getByTestId('aviso-error-sync')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('aviso-error-sync')).toContainText('No se aplicó su cambio');
  await expect(page.getByText(/\$ 95\.000 \//)).toBeVisible();
  await expect(page.getByTestId('estado-sync')).toContainText('Con error');

  const servidor = (await json(await api.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto;
  expect(servidor).toMatchObject({ precio: 95000, version: 2 });

  // El usuario descarta su cambio: queda la versión del servidor y la cola vacía.
  await page.getByRole('button', { name: 'Descartar mi cambio' }).click();
  await expect(page.getByTestId('aviso-error-sync')).toHaveCount(0);
  await expect(page.getByTestId('estado-sync')).toHaveCount(0);
});
