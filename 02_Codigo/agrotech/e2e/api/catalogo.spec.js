// CU-02, CU-03, CU-10 · Publicar, catálogo y edición (RF-02, RF-03, RF-10a) · RNF-01
const { test, expect } = require('@playwright/test');
const { auth, crearCuenta, publicar, pedir, json, percentil } = require('../soporte/api');

test.describe('CU-02 / CU-03 / CU-10 · Inventario y catálogo', () => {
  test('CP-03: el producto publicado queda Activo y aparece en el catálogo con su foto', { tag: '@CP-03' }, async ({ request }) => {
    const productora = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Chinácota' });
    const p = await publicar(request, productora.token, { nombre: 'Papa criolla', municipio: 'Chinácota', precio: 52000 });
    expect(p).toMatchObject({ estado: 'ACTIVA', precio: 52000, municipio: 'Chinácota' });

    const comprador = await crearCuenta(request);
    const catalogo = await json(await request.get('productos?municipio=Chin%C3%A1cota&tamano=50', { headers: auth(comprador.token) }));
    const enCatalogo = catalogo.productos.find((x) => x.id === p.id);
    expect(enCatalogo).toBeTruthy();
    const foto = await request.get(enCatalogo.miniaturaUrl);
    expect(foto.status()).toBe(200);
    expect(foto.headers()['content-type']).toContain('image/jpeg');
  });

  test('CP-05 (API): el filtro por municipio responde solo ese municipio; p95 del servidor ≤ 500 ms con 10 usuarios a la vez', { tag: '@CP-05' }, async ({ request }) => {
    const productora = await crearCuenta(request, { rol: 'PRODUCTOR', municipio: 'Ábrego' });
    for (let i = 0; i < 5; i += 1) await publicar(request, productora.token, { nombre: `Cebolla lote ${i}`, categoria: 'HORTALIZAS', unidad: 'arroba', municipio: 'Ábrego' }, 'cebolla');
    const comprador = await crearCuenta(request);
    const url = 'productos?municipio=%C3%81brego&pagina=1&tamano=20';

    const tiempos = [];
    let bytes = 0;
    for (let ronda = 0; ronda < 10; ronda += 1) {
      await Promise.all(Array.from({ length: 10 }, async () => {
        const t0 = performance.now();
        const r = await request.get(url, { headers: auth(comprador.token) });
        tiempos.push(performance.now() - t0);
        expect(r.status()).toBe(200);
        const b = await r.body();
        bytes = b.length;
        const { productos } = JSON.parse(b.toString());
        expect(productos.length).toBeGreaterThan(0);
        expect(productos.every((x) => x.municipio === 'Ábrego' && x.estado === 'ACTIVA' && x.stock > 0)).toBe(true);
      }));
    }
    const p95 = percentil(tiempos, 95);
    test.info().annotations.push({ type: 'medición', description: `100 consultas (10 concurrentes): p95 = ${Math.round(p95)} ms · respuesta JSON ${Math.round(bytes / 1024)} KB` });
    expect(p95).toBeLessThanOrEqual(500);
  });

  test('CP-13: editar precio y cantidad; con 0 pasa a Agotada y sale del catálogo; el pedido previo conserva su precio', { tag: '@CP-13' }, async ({ request }) => {
    const productora = await crearCuenta(request, { rol: 'PRODUCTOR' });
    const comprador = await crearCuenta(request);
    const p = await publicar(request, productora.token, { precio: 80000, stock: 10 });
    const pedido = (await json(await pedir(request, comprador.token, [{ idProducto: p.id, cantidad: 2 }]))).pedidos[0];

    const editado = await request.patch(`productos/${p.id}`, { headers: auth(productora.token), data: { precio: 90000, stock: 6, version: p.version + 1 } });
    expect(editado.status(), await editado.text()).toBe(200); // la versión subió con el pedido (descuento de stock)
    const v = (await json(editado)).producto;
    expect(v).toMatchObject({ precio: 90000, stock: 6, estado: 'ACTIVA' });

    const agotado = (await json(await request.patch(`productos/${p.id}`, { headers: auth(productora.token), data: { stock: 0, version: v.version } }))).producto;
    expect(agotado.estado).toBe('AGOTADA');
    const catalogo = await json(await request.get('productos?municipio=Pamplona&tamano=50', { headers: auth(comprador.token) }));
    expect(catalogo.productos.some((x) => x.id === p.id)).toBe(false);

    const delPedido = (await json(await request.get(`pedidos/${pedido.id}`, { headers: auth(comprador.token) }))).pedido;
    expect(delPedido.items[0]).toMatchObject({ precioUnitario: 80000, subtotal: 160000 });

    // Conflicto de versión (CP-17 en línea): una versión vieja se rechaza y devuelve la vigente.
    const viejo = await request.patch(`productos/${p.id}`, { headers: auth(productora.token), data: { precio: 1000, version: p.version } });
    expect(viejo.status()).toBe(409);
    expect((await json(viejo)).error.detalles.producto.estado).toBe('AGOTADA');
  });
});
