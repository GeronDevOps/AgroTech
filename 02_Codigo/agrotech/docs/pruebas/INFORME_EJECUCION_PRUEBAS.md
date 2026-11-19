# Informe de ejecución y evidencia de pruebas · AgroTech 1.1.1

| Campo | Valor |
|---|---|
| Versión del documento | 1.1 · 18 de noviembre de 2026 (fecha de corte; 1.1 agrega la ejecución E2E de la EDT 6.9) |
| Versión probada | AgroTech 1.1.1 · Jest sobre el commit `2d85ae6` («refactor: revisión integral, corrección ERR-14 a ERR-17 y puesta a punto pre-entrega») · Jest de las suites modificadas y Playwright E2E sobre `56c7134` (`2d85ae6` + cierre de HALL-02 a HALL-06) |
| Plan de referencia | [PLAN_Y_DISENO_PRUEBAS.md](PLAN_Y_DISENO_PRUEBAS.md) |
| Actividades del cronograma | 6.1 Pruebas del sistema y de aceptación (67 %) · 6.7 Revisión integral (100 %) · 6.8 Plan, informe y presupuesto (50 %) · 6.9 Ejecución E2E (ejecutada el 18/11, adelantada respecto al 20/11) |
| Evidencias | [`evidencias/`](evidencias/) (salidas de Jest, cobertura y Playwright del 18/11) · [INFORME_PRUEBAS_SISTEMA.md](INFORME_PRUEBAS_SISTEMA.md) · [BANCO_PRUEBAS.md](BANCO_PRUEBAS.md) · `e2e/resultados/` e `e2e/informe-html/` (se generan al ejecutar Playwright) |

## 1. Resumen ejecutivo

| Indicador | Resultado | Meta (plan §5.2) | Estado |
|---|---|---|---|
| API · Jest (unitarias + integración) | **244/244** (29 suites) | 100 % | ✅ |
| App · Jest + Testing Library | **98/98** (9 suites) | 100 % | ✅ |
| Lint API (`eslint`) y app (`expo lint`) | 0 errores | 0 | ✅ |
| Cobertura API (líneas) | **95,51 %** | ≥ 90 % | ✅ |
| Cobertura app (líneas) | **83,26 %** | ≥ 80 % | ✅ |
| Casos de sistema CP-01…CP-30 (18/11, commit `56c7134`) | 28 PASA · 0 FALLA · 2 MANUAL (51/51 pruebas) | 100 % de los automatizables | ✅ |
| Casos nuevos CP-31 (ERR-16) y CP-32 (ERR-17) | PASA a nivel Jest | — | ✅ (E2E por automatizar) |
| Banco BP-001…BP-100 (18/11, commit `56c7134`) | 100/100 · 555 llamadas HTTP (16/11: 3 repeticiones, 300/300) | 100 % estable | ✅ |
| Defectos abiertos de severidad Alta o Media | 0 (ERR-01f mitigado, depende del equipo) | 0 | ✅ |
| Usabilidad CP-12 / BP-101 (SUS ≥ 68) | Pendiente: piloto 26/11–01/12 | SUS ≥ 68 | ⏳ |
| Re-ejecución E2E posterior a los cambios del 18/11 (EDT 6.9) | **51/51 sistema · 100/100 banco** · sin regresiones | 100 % | ✅ |
| CP-32 en un teléfono con Expo Go | Pendiente (prueba manual) | PASA | ⏳ |

**Estado de calidad: APTO CON CONDICIONES.** Las pruebas automáticas de la versión 1.1.1 están en verde y cumplen los criterios de cobertura. La re-ejecución E2E y del banco (EDT 6.9) se hizo el 18/11 sobre `56c7134`, que incluye los cambios del 18/11 en `PantallaPerfil.js` y `ventas.service.js`: 51/51 y 100/100, sin regresiones. Antes de publicar la versión final (EDT 6.3, 25/11) queda verificar la foto de perfil (CP-32) en un teléfono con Expo Go. Para aceptar el sistema y cerrar el proyecto falta el piloto (CP-12, CP-15, BP-101…BP-103).

## 2. Ejecuciones registradas

| Fecha | Versión | Suite | Entorno | Resultado | Fuente |
|---|---|---|---|---|---|
| 15/11 | 1.1.0 | API Jest | Ejecución oficial de la Entrega 5 | 232/232 · cobertura 95,67 % de líneas | Entrega 5, §5.1 |
| 15/11 | 1.1.0 | App Jest | Ejecución oficial de la Entrega 5 | 87/87 | Entrega 5, §5.1 |
| 16/11 | 1.1.1 | API Jest / app Jest | Tras corregir ERR-01 … ERR-13 | 244/244 · 97/97 | REGISTRO_DE_ERRORES.md §5 |
| 16/11 04:23 UTC | 1.1.1 | Sistema CP-01…CP-30 (Playwright) | API `:3999`, web `:8090`, Chromium Pixel 7 | 51/51 pruebas · 28 PASA · 2 MANUAL · 60,9 s | INFORME_PRUEBAS_SISTEMA.md |
| 16/11 07:22 UTC | 1.1.1 | Banco BP-001…BP-103 | Ídem | 100/100 PASA · 3 manuales · 555 llamadas HTTP · 3 repeticiones 300/300 | BANCO_PRUEBAS.md, RETOS_BANCO.md |
| 18/11 | 1.1.1 (antes de la revisión) | API Jest | Node 24.22 de Windows, PostgreSQL 17 + PostGIS en `localhost:5434` | **243/244**: falla CP-02 (ERR-14) · 293 s | `evidencias/2026-11-18_api_jest_linea_base_ERR-14.txt` |
| 18/11 | 1.1.1 (antes de la revisión) | App Jest | Ídem | **89/97**: 8 fallos en `sincronizacion.test.js` (ERR-15) · 122 s | `evidencias/2026-11-18_app_jest_linea_base_ERR-15.txt` |
| 18/11 | `2d85ae6` | API Jest | Ídem | **244/244** · 29/29 suites · 314 s | `evidencias/2026-11-18_api_jest.txt` |
| 18/11 | `2d85ae6` | App Jest | Ídem | **98/98** · 9/9 suites · 63 s | `evidencias/2026-11-18_app_jest.txt` |
| 18/11 | `2d85ae6` | Cobertura API y app | Ídem | API 244/244 (220 s) · app 98/98 (65 s) | `evidencias/2026-11-18_cobertura.txt` |
| 18/11 | `2d85ae6` | Lint API y app | Ídem | 0 errores | RESUMEN_REVISION_CODIGO.md §4 |
| 18/11 | `56c7134` | API Jest `fase2/perfil_privacidad` y app Jest `fase2` (HALL-02, HALL-03) | Ídem | 10/10 · 12/12 · lint sin errores | AUDITORIA_FINAL_GEMINI.md §7 |
| 19/11 02:13 UTC (18/11 21:13 hora de Colombia) | `56c7134` | Sistema CP-01…CP-30 (Playwright 1.56, EDT 6.9) | Node 24.22 de Windows, API `:3999` y web `:8090` levantadas por Playwright, base `agrotech_e2e` en `localhost:5434`, Chromium 141 (Pixel 7), 1 worker | **51/51 pruebas · 28 PASA · 0 FALLA · 2 MANUAL** · 173,6 s | `evidencias/2026-11-18_e2e_sistema.txt`, `evidencias/2026-11-18_e2e_sistema_matriz.md` |
| 19/11 02:16 UTC | `56c7134` | Banco BP-001…BP-103 (EDT 6.9) | Ídem | **100/100 PASA** · 3 manuales · 555 llamadas HTTP · 21 capturas · 2,0 min | `evidencias/2026-11-18_e2e_banco.txt`, `evidencias/2026-11-18_e2e_banco_matriz.md` |

Todas las ejecuciones del 18/11 fueron secuenciales y en primer plano (`--runInBand`, `CI=true`, `--watchAll=false`), sin modos `--watch`. Playwright se ejecutó con `--workers=1` (la configuración trae 2) para no hacer trabajo en paralelo sobre `/mnt/c`, y al terminar detuvo la API y la vista web (puertos 3999 y 8090 libres).

## 3. Resultados de Jest por suite (18/11, commit `2d85ae6`)

### 3.1 API · 29 suites · 244 pruebas

| Nivel | Suites (todas PASS) |
|---|---|
| Integración (18) | `auth`, `comunicacion`, `sync`, `productos`, `pedidos`, `pagos`, `ventas`, `tiempoReal`, `sembrar`, `push`, `fotos-s3`, `salud`, `fase2/cuentas`, `fase2/notificaciones`, `fase2/pedidos`, `fase2/perfil_privacidad`, `fase2/productos`, `fase2/reportes_admin` |
| Unitarias (11) | `arranque`, `autenticacion`, `auth.service`, `auth.validacion`, `error-handler`, `fase2.validaciones`, `fcm`, `fotos-s3`, `informe-piloto`, `productos`, `salud.service` |

Las suites más largas (sobre la carpeta de OneDrive): `comunicacion` 52,9 s, `fase2/reportes_admin` 32,7 s, `sync` 32,2 s, `pedidos` 31,6 s.

### 3.2 App · 9 suites · 98 pruebas

| Suite | Contenido | Resultado |
|---|---|---|
| `sincronizacion` | Publicar y editar sin señal, conflictos, catálogo y pedidos desde la copia local (CU-17) | PASS (11) |
| `fase2` | Recuperar contraseña, perfil (incluida la **foto de perfil, CP-32**), pausar/retirar, búsqueda y cercanía, cancelar, historial, avisos, panel, reportes, privacidad | PASS (12) |
| `comunicacion` | Chat y calificaciones en tiempo real | PASS |
| `pedidos` | Carrito, confirmación idempotente, estados, pago | PASS |
| `navegacion` | Rutas por rol y protección de pantallas | PASS |
| `productos` | Publicar con foto comprimida y catálogo | PASS |
| `cuenta` | Registro, inicio de sesión, bloqueo | PASS |
| `cliente` | Cliente HTTP, errores normalizados, token | PASS |
| `servidor` | Resolución automática de la URL de la API (ERR-01c/e) | PASS |

### 3.3 Diferencias con la línea base y su causa

| Ejecución | Antes | Después | Causa y corrección |
|---|---|---|---|
| API | 243/244 | 244/244 | **ERR-14:** `bloqueado_hasta` lo calcula PostgreSQL y la prueba lo compara con el reloj de Node (`15,00005 > 15`). Tolerancia de 5 s, igual que las pruebas E2E. La lógica de bloqueo no cambió |
| API | 244 pruebas | 244 pruebas | La prueba de periodo inválido de `ventas.test.js` se amplió con CP-31 (ERR-16) sin agregar pruebas nuevas |
| App | 89/97 | 98/98 | **ERR-15:** la primera suite superaba el límite de 5 s de Jest por el disco de OneDrive y arrastraba 7 fallos más. `testTimeout: 30000`. Se agregó la prueba de CP-32 (ERR-17): 97 → 98 |

## 4. Cobertura de código

| Métrica | API 1.1.0 (15/11) | API 1.1.1 (18/11) | App 1.1.1 (18/11) |
|---|---|---|---|
| Sentencias | — | 91,35 % (2494/2730) | 79,16 % (2155/2722) |
| Ramas | 80,16 % | 79,78 % (1476/1850) | 71,58 % (1542/2154) |
| Funciones | — | 93,01 % (519/558) | 71,16 % (580/815) |
| **Líneas** | **95,67 %** | **95,51 %** (2172/2274) | **83,26 %** (1905/2288) |

- API: `collectCoverageFrom: src/**/*.js` sin `server.js` (el arranque se prueba en `arranque.test.js`). La variación de −0,16 puntos en líneas frente a la 1.1.0 viene del código de arranque y diagnóstico de la 1.1.1 (ERR-01), que se cubre de forma parcial.
- App: primera medición formal (`--collectCoverageFrom=src/**/*.js`). Lo menos cubierto son los módulos nativos que se reemplazan por simulaciones en Jest (push, ubicación, cámara, archivos) y algunas ramas de error de las pantallas del administrador.

## 5. Pruebas de sistema E2E (Playwright)

### 5.1 Estado del inventario automatizado

Todas las pruebas de la tabla están **automatizadas y listas para ejecutarse con el servidor activo**. Playwright levanta la API en `:3999` y la vista web en `:8090`; solo hacen falta PostgreSQL y las dependencias de `e2e/`.

| Archivo | Proyecto | Pruebas | Casos | Requisito adicional | Última ejecución (18/11, `56c7134`) |
|---|---|---|---|---|---|
| `e2e/api/cuentas.spec.js` | api | 3 | CP-01, CP-02, RNF-04 | — | PASA |
| `e2e/api/catalogo.spec.js` | api | 3 | CP-03, CP-05, CP-13 | — | PASA |
| `e2e/api/pedidos.spec.js` | api | 5 | CP-06, CP-07, CP-08, CP-14, CP-16 | — | PASA |
| `e2e/api/comunicacion.spec.js` | api (+ WebSocket) | 4 | CP-09, CP-10, CP-11 | — | PASA |
| `e2e/api/sincronizacion.spec.js` | api | 3 | CP-17 (incluye RNF-03) | — | PASA |
| `e2e/api/pagos.spec.js` | api | 3 | CP-18, CP-19 | `E2E_WOMPI_SECRETO_EVENTOS` (si falta, se omiten) | PASA |
| `e2e/api/fase2.spec.js` | api (+ WebSocket) | 11 | CP-20 … CP-30 | Buzón de correo (driver `archivo`) para CP-20 | PASA |
| `e2e/ui/cuenta_catalogo.spec.js` | ui (Chromium Pixel 7) | 3 | CP-01, CP-04, CP-05 | 3G simulado, modo avión | PASA |
| `e2e/ui/pedidos_comunicacion.spec.js` | ui | 5 | CP-09, CP-10, CP-11, CP-14, CP-17 | Dos contextos de navegador | PASA |
| `e2e/ui/fase2.spec.js` | ui | 11 | CP-20 … CP-30 | Geolocalización de Ocaña; panel a 1280 × 900 | PASA |
| **Subtotal sistema** | | **51** | 28 casos automatizados | | **51/51** |
| `e2e/banco/cuentas_perfil.api.spec.js` | banco (API) | 23 | BP-001 … BP-023 | — | 23/23 |
| `e2e/banco/inventario_catalogo.api.spec.js` | banco (API) | 23 | BP-024 … BP-046 | — | 23/23 |
| `e2e/banco/pedidos_comunicacion.api.spec.js` | banco (API) | 29 | BP-047 … BP-075 | — | 29/29 |
| `e2e/banco/admin_rnf.api.spec.js` | banco (API) | 13 | BP-076 … BP-088 | — | 13/13 |
| `e2e/banco/interfaz.ui.spec.js` | banco (UI) | 12 | BP-089 … BP-100 | — | 12/12 |
| **Subtotal banco** | | **100** | 100 casos automatizados | | **100/100** (16/11: ×3 = 300/300) |

**No automatizados (manuales):** CP-12 y BP-101 (usabilidad, SUS), CP-15 y BP-102 (push con la app cerrada; requiere el APK con Firebase), BP-103 (Android de gama baja). **Diseñados, cubiertos por Jest y todavía sin E2E:** CP-31 y CP-32.

### 5.2 Ejecución de la EDT 6.9 (18/11) y cómo repetirla

La EDT 6.9 se adelantó al 18/11 y se ejecutó sobre el commit `56c7134` en este orden, un paso a la vez: instalación de `e2e/node_modules` (`npm ci`, Playwright 1.56.0) y de Chromium 141 con el npm de Windows; `npm run preparar` (migra la base `agrotech_e2e`, crea el administrador de pruebas y compila la vista web en 55 s); suite de sistema; banco. Los servidores los levantó y detuvo Playwright (`webServer`), sin reutilizar procesos previos: antes de empezar se comprobó que los puertos 3999 y 8090 estaban libres.

```bat
:: En Windows (cmd), con PostgreSQL + PostGIS activo en localhost:5434
cd e2e
npm ci
npx playwright install chromium
set E2E_DATABASE_URL=postgres://postgres:<clave>@localhost:5434/agrotech_e2e
npm run preparar                  :: crea/migra la base E2E y compila la vista web
npx playwright test --workers=1   :: CP-01…CP-30 → resultados/informe-cp.md e informe-html/
npm run banco -- --workers=1      :: BP-001…BP-103 → resultados/banco/banco.md
```

**Riesgo de regresión vigilado:** «Mi perfil» tiene ahora una sección de foto encima de los campos. CP-21 (API y UI) y BP-096 pasaron: los campos se localizan por su etiqueta accesible y no se vieron afectados. `GET /ventas` (ERR-16) se cubrió con CP-11 (API y UI) y BP-069 (panel de ventas del productor), todos en PASA.

**Observaciones de la ejecución:**
- El banco se ejecutó una vez (el 16/11 se hicieron 3 repeticiones, 300/300); no hubo pruebas inestables ni reintentos.
- CP-05 dio p95 del servidor de 290 ms con 10 consultas concurrentes (16/11: 97 ms). Sigue muy por debajo del umbral de 3 s (RNF-01); el aumento se atribuye a que la API corrió en el portátil de desarrollo sobre OneDrive, con Chromium en el mismo equipo. Conviene tomar la medición oficial de RNF-01 en el servidor de AWS.
- CP-31 y CP-32 siguen fuera de la matriz de Playwright (solo Jest), y CP-32 falta en el teléfono con Expo Go.

## 6. Métricas de casos de prueba

| Conjunto | Diseñados | Automatizados | PASA | FALLA | MANUAL / pendiente | % PASA sobre automatizables |
|---|---|---|---|---|---|---|
| CP-01 … CP-30 (sistema) | 30 | 28 | 28 | 0 | 2 (CP-12, CP-15) | 100 % |
| CP-31, CP-32 (nuevos) | 2 | 2 (Jest) | 2 | 0 | E2E por automatizar | 100 % |
| **Total CP** | **32** | **30** | **30** | **0** | **2** | **100 %** (93,8 % del total) |
| BP-001 … BP-103 (banco) | 103 | 100 | 100 | 0 | 3 (BP-101…BP-103) | 100 % |
| Pruebas Jest API | 244 | 244 | 244 | 0 | — | 100 % |
| Pruebas Jest app | 98 | 98 | 98 | 0 | — | 100 % |

Mediciones de RNF de la ejecución E2E del 18/11 (entre paréntesis, la del 16/11): CP-05 p95 del servidor 290 ms con 10 consultas concurrentes (97 ms) y p95 de 0,98 s en 3G (1,09 s; umbral 3 s); CP-09 entrega por WebSocket p50 11 ms / p95 18 ms (9 / 81 ms) y pantalla a pantalla p95 202 ms (129 ms); CP-28 tres avisos en 67 ms (104 ms); CP-04 publicación 1,0 s después de volver la señal (0,4 s); CP-24 búsqueda en 8 ms y resultados visibles en 284 ms; CP-02 bloqueo de 15,0 min.

## 7. Defectos

Fuente: [REGISTRO_DE_ERRORES.md](REGISTRO_DE_ERRORES.md) (fecha de corte 18/11).

| Severidad | Cantidad | IDs | Estado |
|---|---|---|---|
| Alta | 6 | ERR-01a, 01b, 01c, 02, 03, 06 | Corregidos y verificados |
| Media | 7 | ERR-01d, 01f, 04, 07, 09, 10, 17 | 6 corregidos · ERR-01f mitigado (Firewall de Windows) |
| Baja | 9 | ERR-01e, 05, 08, 11, 12, 13, 14, 15, 16 | Corregidos y verificados |
| **Total** | **22** | ERR-01 (reportado por el usuario) con sus 6 causas, más ERR-02 … ERR-17 | 21 corregidos · 1 mitigado · **0 abiertos** |

Hallazgos de la revisión del 18/11:

| ID | Tipo | Detectado por | Prueba de regresión |
|---|---|---|---|
| ERR-14 | Prueba frágil (reloj) | Ejecución de Jest | CP-02 con tolerancia |
| ERR-15 | Entorno de pruebas | Ejecución de Jest | Suite de sincronización completa en primera posición |
| ERR-16 | Validación de entrada | Revisión de código | CP-31 |
| ERR-17 | Inconsistencia backend ↔ app | Revisión de código | CP-32 |

**Densidad de defectos:** 22 defectos registrados en las versiones 1.1.0–1.1.1, ninguno detectado en producción (fallos externos = 0). Según el campo «Origen» de la bitácora: 12 (55 %) los detectaron las pruebas automáticas (Jest, Playwright, banco, CI), 7 (32 %) vienen del error reportado por el usuario (ERR-01a…f, ERR-02), 2 (9 %) de la revisión de código (ERR-16, ERR-17) y 1 (5 %) del lint (ERR-05).

## 8. Observaciones

1. **Entorno local:** el repositorio está en OneDrive bajo WSL y `node_modules` se instaló desde Windows. Las pruebas se ejecutan con el Node de Windows (24.22) contra PostgreSQL en `localhost:5434`. La CI (Linux, Node 22) es la referencia oficial.
2. **Validación UCD (EDT 5.4, 13/10):** sigue en 0 % en el cronograma y no hay resultados en `docs/piloto/`. Si se hizo, hay que registrar la evidencia; si no, conviene hacerla antes o al inicio del piloto (26/11).
3. **CP-31 y CP-32** se diseñaron y están cubiertos por Jest. Para tenerlos en la matriz automática de Playwright hay que agregarlos a `e2e/casos.js` con sus pruebas `@CP-31` / `@CP-32`.
4. **CP-32 en el teléfono:** la selección de la foto (expo-image-picker) solo se simuló en Jest. Falta verificarla con Expo Go en Android.

## 9. Conclusión

La versión 1.1.1 (commits `2d85ae6` y `56c7134`) cumple los criterios de salida automatizables del plan: 100 % de las pruebas en verde (244 API, 98 app), cobertura por encima de las metas (95,51 % y 83,26 % de líneas), 30/30 casos de sistema automatizables en PASA, E2E repetida tras los cambios del 18/11 (51/51 sistema, 100/100 banco) y ningún defecto abierto de severidad Alta o Media. **Estado: APTO CON CONDICIONES.** Antes de publicar la versión final queda una condición (verificar CP-32 en el teléfono con Expo Go) y, para la aceptación del cliente, el piloto.
