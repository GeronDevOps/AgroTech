// Pruebas de interfaz: CU-01 registro, CU-02/CU-17 publicar sin señal, CU-03 catálogo con 3G
const crypto = require('node:crypto');
const path = require('node:path');
const {
  test, expect, entrar, red, emular3G, tarjetasVisibles,
} = require('./ayudas');
const {
  auth, json, crearCuenta, publicar, percentil, CONTRASENA,
} = require('../soporte/api');
const { UMBRAL_CATALOGO_MS } = require('../entorno');

test('CP-01 (UI): registrarse como consumidor abre la sesión en el catálogo', { tag: '@CP-01' }, async ({ page, api }) => {
  const correo = `e2e.ui.${crypto.randomBytes(4).toString('hex')}@agrotech.test`;
  const celular = `3${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByRole('button', { name: /^Compro productos/ }).click();
  await page.getByLabel('Nombres').fill('Andrea');
  await page.getByLabel('Apellidos').fill('Prueba');
  await page.getByLabel('Celular').fill(celular);
  await page.getByLabel('Correo').fill(correo);
  await page.getByRole('button', { name: 'Elegir municipio' }).click();
  await page.getByLabel('Buscar municipio').fill('pampl');
  await page.getByRole('button', { name: 'Pamplona', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Municipio: Pamplona. Cambiar' })).toBeVisible(); // la hoja ya se cerró
  await expect(page.getByLabel('Buscar municipio')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(CONTRASENA);
  await expect(page.getByRole('textbox', { name: 'Contraseña', exact: true })).toHaveValue(CONTRASENA);

  // Sin la autorización (Ley 1581) no se crea la cuenta.
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('error-registro')).toBeVisible();

  await page.getByRole('checkbox', { name: /^Autorizo el tratamiento/ }).click();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('button', { name: /^Mi carrito/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Filtro Municipio' })).toBeVisible();

  // La cuenta existe con su rol (verificado por la API).
  const sesion = await json(await api.post('auth/sesion', { data: { identificador: correo, contrasena: CONTRASENA } }));
  expect(sesion.usuario).toMatchObject({ rol: 'CONSUMIDOR', municipio: 'Pamplona', nombres: 'Andrea' });
});

test('CP-04: publicar en modo avión queda «Pendiente» y se publica solo al volver la red', { tag: '@CP-04' }, async ({ page, api }) => {
  const rosa = await crearCuenta(api, { rol: 'PRODUCTOR', nombres: 'Rosa' });
  const nombre = `Tomate e2e ${crypto.randomBytes(3).toString('hex')}`;
  await entrar(page, rosa.correo);
  await expect(page.getByText('Hola, Rosa')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000); // primera sincronización (copia local)

  await red(page, false);
  await page.getByRole('button', { name: 'Publicar producto' }).click();
  await expect(page.getByText(/Puede publicar igual/)).toBeVisible();
  const elegir = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir de la galería' }).click();
  await (await elegir).setFiles(path.resolve(__dirname, '../fixtures/papa.jpg'));
  await expect(page.getByLabel('Foto del producto')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('radio', { name: 'Tomate' }).click();
  await page.getByLabel('Nombre del producto').fill(nombre);
  await page.getByLabel('Cantidad disponible').fill('12');
  await page.getByLabel(/^Precio por/).fill('45000');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();

  await expect(page.getByTestId('aviso-en-cola')).toBeVisible({ timeout: 15_000 });
  const tarjeta = page.getByRole('button', { name: new RegExp(`^${nombre}`) });
  await expect(tarjeta).toHaveAccessibleName(/Pendiente por sincronizar/);
  const mios = async () => (await json(await api.get('productos/mios', { headers: auth(rosa.token) }))).productos;
  expect((await mios()).map((p) => p.nombre)).not.toContain(nombre); // aún no llegó al servidor

  const reconecta = Date.now();
  await red(page, true);
  await expect(tarjeta).not.toHaveAccessibleName(/Pendiente por sincronizar|Enviando/, { timeout: 30_000 });
  await expect.poll(async () => (await mios()).find((p) => p.nombre === nombre), { timeout: 10_000 })
    .toMatchObject({ estado: 'ACTIVA', stock: 12, precio: 45000 });
  test.info().annotations.push({ type: 'medición', description: `Publicada ${((Date.now() - reconecta) / 1000).toFixed(1)} s después de volver la señal` });
});

test('CP-05 (UI): filtro por municipio con 3G simulado en máximo 3 s', { tag: '@CP-05' }, async ({ page, api }) => {
  test.setTimeout(120_000);
  const marta = await crearCuenta(api, { rol: 'PRODUCTOR', municipio: 'Ábrego' });
  for (const [i, img] of ['cebolla', 'papa', 'platano'].entries()) {
    await publicar(api, marta.token, { nombre: `Cosecha de Ábrego ${i + 1}`, municipio: 'Ábrego', stock: 30 }, img);
  }
  const andres = await crearCuenta(api);
  await entrar(page, andres.correo);
  await expect(page.getByRole('button', { name: 'Filtro Municipio' })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  // Regresión: con muchos productos la barra de filtros no debe quedar aplastada bajo la lista.
  const chip = page.getByRole('button', { name: 'Filtro Municipio' });
  expect(await chip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);

  await emular3G(page);
  const tiempos = [];
  for (let i = 0; i < 5; i += 1) {
    await page.getByRole('button', { name: /^Filtro (Municipio|Todos)/ }).click();
    await page.getByLabel('Buscar en Municipio').fill('abre');
    const inicio = Date.now();
    await page.getByRole('button', { name: 'Ábrego', exact: true }).click();
    await page.waitForResponse((r) => r.url().includes('municipio=%C3%81brego') && r.status() === 200);
    await expect.poll(async () => {
      const t = await tarjetasVisibles(page);
      return t.length > 0 && t.every((x) => x.municipio === 'Ábrego');
    }, { intervals: [25] }).toBe(true);
    tiempos.push(Date.now() - inicio);

    // Volver a "Todos" para la siguiente medición (no se mide).
    await page.getByRole('button', { name: 'Filtro Ábrego' }).click();
    await page.getByRole('button', { name: 'Todos los municipios' }).click();
    await expect(page.getByRole('button', { name: 'Filtro Municipio' })).toBeVisible();
    await page.waitForTimeout(1000);
  }
  const p95 = percentil(tiempos, 95);
  test.info().annotations.push({ type: 'medición', description: `3G (562 ms, 1,44 Mbps): ${tiempos.map((t) => `${(t / 1000).toFixed(2)} s`).join(' · ')} → p95 ${(p95 / 1000).toFixed(2)} s (umbral ${UMBRAL_CATALOGO_MS / 1000} s)` });
  expect(p95).toBeLessThanOrEqual(UMBRAL_CATALOGO_MS);
});
