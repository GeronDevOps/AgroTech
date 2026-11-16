// Banco de pruebas · Interfaz de la app (Expo web, Pixel 7) con captura por paso (BP-089 … BP-100)
const crypto = require('node:crypto');
const { bp, expect, captura, entrar } = require('./soporte');
const {
  auth, json, crearCuenta, publicar, pedir, primerPedido, marca, tel, correoNuevo, ADMIN, CONTRASENA,
} = require('./comun');

async function red(page, enLinea) {
  await page.context().setOffline(!enLinea);
  await page.evaluate(() => navigator.connection && navigator.connection.dispatchEvent(new Event('change')));
}
const tarjetas = (page) => page.getByRole('button', { name: / disponibles, / });

bp('BP-089', async ({ page, api }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByRole('button', { name: /^Compro productos/ }).click();
  await page.getByLabel('Nombres').fill('Andrea');
  await page.getByLabel('Apellidos').fill('Banco');
  await page.getByLabel('Celular').fill(tel());
  const correo = correoNuevo();
  await page.getByLabel('Correo').fill(correo);
  await page.getByRole('button', { name: 'Elegir municipio' }).click();
  await page.getByLabel('Buscar municipio').fill('pampl');
  await page.getByRole('button', { name: 'Pamplona', exact: true }).click();
  await expect(page.getByLabel('Buscar municipio')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('error-registro')).toBeVisible();
  await captura(page, 'sin autorizacion no avanza');
  await page.getByRole('checkbox', { name: /^Autorizo el tratamiento/ }).click();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('button', { name: /^Mi carrito/ })).toBeVisible({ timeout: 15_000 });
  await captura(page, 'catalogo tras el registro');
  expect((await api.post('auth/sesion', { data: { identificador: correo, contrasena: CONTRASENA } })).status()).toBe(200);
});

bp('BP-090', async ({ page, api }) => {
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo, 'claveErrada2026');
  await expect(page.getByTestId('error-sesion')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  await captura(page, 'contrasena errada');
});

bp('BP-091', async ({ page, api }) => {
  const m = marca();
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR' });
  await publicar(api, rosa.token, { nombre: `Mora ${m}`, categoria: 'FRUTAS', unidad: 'kg', precio: 4500 }, 'platano');
  await publicar(api, rosa.token, { nombre: `Papa ${m}` });
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await expect(page.getByRole('button', { name: 'Filtro Categoría' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Filtro Categoría' }).click();
  await captura(page, 'hoja de categorias');
  await page.getByRole('button', { name: 'Frutas', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Mora ${m}`) })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: new RegExp(`^Papa ${m}`) })).toHaveCount(0);
  const frutas = (await json(await api.get('productos?categoria=FRUTAS&tamano=50', { headers: auth(andres.token) }))).productos.map((p) => p.nombre);
  const visibles = await tarjetas(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').split(',')[0]));
  expect(visibles.length).toBeGreaterThan(0);
  for (const n of visibles) expect(frutas).toContain(n);
  await captura(page, 'solo frutas');
});

bp('BP-092', async ({ page, api }) => {
  const m = marca();
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const nombre = `Papa ${m}`;
  await publicar(api, rosa.token, { nombre, stock: 10 });
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await page.getByLabel('Buscar productos').fill(nombre);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
  await page.getByRole('button', { name: '🛒 Agregar al carrito' }).click();
  await expect(page.getByTestId('aviso-agregado')).toBeVisible();
  await captura(page, 'producto agregado');
  await page.getByRole('button', { name: '🛒 Ver carrito' }).click();
  await page.getByLabel('Punto de entrega').fill('Parque principal de Pamplona');
  await page.getByRole('radio', { name: /Mañana/ }).click();
  await captura(page, 'carrito listo');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByTestId('aviso-pedido')).toContainText('Pedido confirmado', { timeout: 15_000 });
  await captura(page, 'pedido confirmado');
  const { pedidos } = await json(await api.get('pedidos', { headers: auth(andres.token) }));
  expect(pedidos[0]).toMatchObject({ estado: 'PENDIENTE' });
});

bp('BP-093', async ({ page, api }) => {
  const m = marca();
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR' });
  await publicar(api, rosa.token, { nombre: `Papa ${m}` });
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await expect(tarjetas(page).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000); // primera sincronización: copia local del catálogo
  await red(page, false);
  // La app web no tiene service worker: sin red no se recarga la página, se consulta el catálogo dentro de la app.
  await page.getByLabel('Buscar productos').fill(`Papa ${m}`);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByTestId('aviso-sin-senal')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: new RegExp(`^Papa ${m}`) })).toBeVisible();
  await captura(page, 'catalogo sin senal desde la copia local');
  await red(page, true);
});

bp('BP-094', async ({ page, api }) => {
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await page.getByLabel('Buscar productos').fill('pa');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Escriba al menos 3 letras.')).toBeVisible({ timeout: 10_000 });
  await captura(page, 'minimo tres letras');
  await page.getByLabel('Buscar productos').fill(`zzq${marca()}`);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByTestId('sugerencias')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('catalogo-vacio')).toContainText('No encontramos');
  await captura(page, 'sin resultados con sugerencias');
});

bp('BP-095', async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(api);
  const papa = await publicar(api, rosa.token, { stock: 10 });
  const p = await primerPedido(await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 2 }]));
  await entrar(page, andres.correo);
  await page.getByRole('button', { name: 'Mis pedidos' }).click();
  await page.getByRole('button', { name: /^Pedido de Rosa.*Pendiente/ }).click();
  await page.getByRole('button', { name: 'Cancelar pedido' }).click();
  await page.getByRole('radio', { name: 'Me equivoqué en el pedido' }).click();
  await captura(page, 'motivo elegido');
  await page.getByRole('button', { name: 'Sí, cancelar el pedido' }).click();
  await expect(page.getByTestId('aviso-pedido')).toContainText('Pedido cancelado', { timeout: 15_000 });
  await captura(page, 'pedido cancelado');
  expect((await json(await api.get(`pedidos/${p.id}`, { headers: auth(andres.token) }))).pedido.estado).toBe('CANCELADO');
});

bp('BP-096', async ({ page, api }) => {
  const andres = await crearCuenta(api, { nombres: 'Andres' });
  await entrar(page, andres.correo);
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await page.getByLabel('Celular').fill('312345678');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Escriba un celular de 10 dígitos que empiece por 3.')).toBeVisible({ timeout: 10_000 });
  await captura(page, 'celular invalido');
  expect((await json(await api.get('perfil', { headers: auth(andres.token) }))).perfil.telefono).toBe(andres.telefono);
});

bp('BP-097', async ({ page, api }) => {
  const nombre = `Papa ${marca()}`;
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR' });
  const andres = await crearCuenta(api);
  const papa = await publicar(api, rosa.token, { nombre, stock: 10 });
  await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 1 }]);
  await entrar(page, rosa.correo);
  await page.getByRole('button', { name: /^Mis productos/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
  await page.getByRole('button', { name: '🗑 Retirar publicación' }).click();
  await captura(page, 'confirmar retiro');
  await page.getByRole('button', { name: 'Sí, retirar' }).click();
  await expect(page.getByTestId('aviso-editar')).toContainText('en curso', { timeout: 10_000 });
  await expect(page.getByTestId('aviso-editar')).toContainText('pausarla');
  await captura(page, 'retiro rechazado por pedido en curso');
  expect((await json(await api.get(`productos/${papa.id}`, { headers: auth(rosa.token) }))).producto.estado).toBe('ACTIVA');
});

bp('BP-098', async ({ page, api }) => {
  // Los apellidos solo admiten letras: sufijo aleatorio de letras para encontrarlo en la búsqueda.
  const apellido = `Banco ${Array.from(crypto.randomBytes(6), (b) => String.fromCharCode(97 + (b % 26))).join('')}`;
  const luis = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Luis' });
  expect((await api.patch('perfil', { headers: auth(luis.token), data: { apellidos: apellido } })).status()).toBe(200);
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page, ADMIN.correo, ADMIN.contrasena);
  await expect(page.getByTestId('resumen-admin')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Usuarios/ }).click();
  await page.getByLabel('Buscar usuarios').fill(apellido);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^Luis ${apellido}, productor`) }).click();
  await captura(page, 'ficha del productor');
  await page.getByRole('button', { name: '✔ Marcar como productor verificado' }).click();
  await expect(page.getByTestId('aviso-usuario-admin')).toContainText('Productor verificado', { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: new RegExp(`Luis ${apellido} ✔`) })).toBeVisible();
  await captura(page, 'productor verificado');
});

bp('BP-099', async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const andres = await crearCuenta(api);
  const papa = await publicar(api, rosa.token, { stock: 10 });
  await entrar(page, rosa.correo);
  await expect(page.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await captura(page, 'inicio sin avisos');
  await pedir(api, andres.token, [{ idProducto: papa.id, cantidad: 1 }]);
  await expect(page.getByRole('button', { name: 'Avisos, 1 sin leer' })).toBeVisible({ timeout: 15_000 });
  await captura(page, 'un aviso sin leer');
});

bp('BP-100', async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  await entrar(page, rosa.correo);
  await expect(page.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const botones = await page.getByRole('button').evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { nombre: e.getAttribute('aria-label') || e.textContent.trim(), alto: Math.round(r.height), ancho: Math.round(r.width) }; }));
  require('@playwright/test').test.info().annotations.push({ type: 'medición', description: `${botones.length} botones; alto mínimo ${Math.min(...botones.map((b) => b.alto))} px` });
  expect(botones.length).toBeGreaterThan(3);
  for (const b of botones) {
    expect(b.nombre, 'Botón sin nombre accesible').toBeTruthy();
    expect(b.alto, `«${b.nombre}» mide ${b.alto} px de alto`).toBeGreaterThanOrEqual(48);
  }
  await captura(page, 'inicio del productor');
});
