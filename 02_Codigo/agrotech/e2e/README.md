# Pruebas de sistema automatizadas · AGRO-14

Suite de caja negra con **Playwright Test** que ejecuta los casos CP-01…CP-19 del plan de pruebas (Entrega 4) contra el sistema completo.

| Proyecto | Qué ejecuta | Cómo habla con el sistema |
|---|---|---|
| `api` | 21 pruebas · 16 casos | API REST (`request` de Playwright) y WebSocket `/ws` (paquete `ws`) |
| `ui` | 8 pruebas · 8 casos | App web de Expo en Chromium con tamaño de teléfono (Pixel 7); 3G simulado por CDP; modo avión con `setOffline` |
| Manual | CP-12 (piloto, SUS) · CP-15 (push con APK + Firebase) | Ver `docs/piloto/` y `api/tests/integration/push.test.js` |

## Ejecutar en local

Requisitos: PostgreSQL con PostGIS en marcha, `npm ci` en `api/`, `app/` y `e2e/`.

```bash
cd e2e
npx playwright install chromium        # una sola vez
export E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/agrotech_e2e
npm run preparar                       # crea/migra la base E2E y compila la app web contra la API de pruebas
npm test                               # levanta la API (:3999) y la web (:8090), ejecuta todo y genera los informes
npm run test:api                       # solo la API (no necesita navegador)
npm run informe                        # abre el informe HTML
```

## Ejecutar contra un servidor desplegado

```bash
E2E_API_URL=https://api.agrotech.co E2E_WOMPI_SECRETO_EVENTOS=<secreto de eventos del sandbox> npx playwright test --project=api
```

Cada prueba crea sus propios usuarios (`e2e.*@agrotech.test`), productos y pedidos: no requiere base vacía. Sin `E2E_WOMPI_SECRETO_EVENTOS`, CP-18 y CP-19 se omiten.

## Salidas

| Archivo | Uso |
|---|---|
| `resultados/informe-cp.md` / `.json` | Matriz CP → veredicto (PASA, FALLA, MANUAL) con mediciones (p95, latencias). Se pega en el informe de pruebas. |
| `informe-html/` | Detalle por prueba; trazas y capturas de las fallas. |
| `resultados/junit.xml` | Resultado para CI. |

## Convenciones

- Cada prueba lleva la etiqueta del caso: `{ tag: '@CP-05' }`. El reportero `reportero-cp.js` cruza las etiquetas con `casos.js`.
- Las mediciones se registran con `test.info().annotations.push({ type: 'medición', description })`.
- Umbrales: CP-05 ≤ 3 s con 3G (RNF-01) y p95 del servidor ≤ 500 ms; CP-09 p95 < 2 s (API) y < 3 s (pantalla a pantalla).
- CI: `.github/workflows/e2e.yml` (PR hacia `main`, cada noche y a demanda contra una URL).
