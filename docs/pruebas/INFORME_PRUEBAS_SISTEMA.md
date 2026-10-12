# Informe de pruebas de sistema · AgroTech v1.0.0 (AGRO-14)

| Campo | Valor |
|---|---|
| Nivel | Pruebas de sistema, caja negra (Entrega 4 · estrategia de pruebas) |
| Herramienta | Playwright Test 1.56: contexto `request` (API REST), cliente `ws` (WebSocket `/ws`), Chromium con tamaño de teléfono (Pixel 7) sobre la app web de Expo |
| Simulación de red | CP-04 y CP-17: modo avión (`setOffline`); CP-05: perfil 3G de Chrome DevTools por CDP (562,5 ms de latencia, 1,44 Mbps) |
| Datos | Cada prueba crea sus propios usuarios, productos y pedidos por la API (sin acceso a la base): se puede repetir contra un servidor desplegado |
| Ejecución | Clon limpio de `release/v1.0.0`, base de datos nueva, `CI=1` (sin reutilizar servidores) |
| Reproducir | `cd e2e && npm run preparar && npm test` (ver `e2e/README.md`) |

**Limitaciones.** La API y el navegador corren en la misma máquina: los tiempos del servidor no incluyen la red real; la red móvil se simula solo en CP-05 (interfaz). CP-12 (usabilidad) y CP-15 (push con la app cerrada) requieren personas y un teléfono con el APK: se ejecutan en el piloto (`docs/piloto/`). Las pruebas unitarias y de integración (API 177, app 76) complementan esta suite.

- **Fecha:** 2026-10-12 01:19 UTC
- **Entorno:** local (API y app web levantadas por Playwright) · API `http://localhost:3999` · Web `http://localhost:8090`
- **Resultado global de la ejecución:** passed · duración 35.5 s
- **Casos:** 19 · PASA 17 · FALLA 0 · MANUAL 2 · OMITIDO 0 · SIN PRUEBA 0

## Matriz de trazabilidad

| CP | CU / RNF | Tipo | Resultado esperado | Ejecución | Veredicto | Pruebas | Mediciones |
|---|---|---|---|---|---|---|---|
| CP-01 | CU-01 | Sistema | Cuenta creada con su rol; sesión abierta. | api + ui | **PASA** | 2/2 | — |
| CP-02 | CU-01 | Seguridad | Mensaje genérico y bloqueo de 15 minutos. | api | **PASA** | 1/1 | Bloqueo de 15.0 min tras el 5.º intento |
| CP-03 | CU-02 | Sistema | Producto "Activo" visible en el catálogo. | api | **PASA** | 1/1 | — |
| CP-04 | CU-02, CU-17 | Sistema | Queda "Pendiente" y se publica solo al volver la red. | ui | **PASA** | 1/1 | Publicada 0.5 s después de volver la señal |
| CP-05 | CU-03 | Rendimiento | Solo productos de ese municipio, en máximo 3 s. | api + ui | **PASA** | 2/2 | 100 consultas (10 concurrentes): p95 = 122 ms · respuesta JSON 4 KB; 3G (562 ms, 1,44 Mbps): 1.06 s · 0.89 s · 0.88 s · 0.93 s · 0.89 s → p95 1.06 s (umbral 3 s) |
| CP-06 | CU-04 | Sistema | Stock descontado, pedido "Pendiente" y aviso al productor. | api | **PASA** | 1/1 | Aviso «pedido_nuevo» al productor en 17 ms |
| CP-07 | CU-04 | Integración | Solo se crea un pedido; el otro recibe el aviso de stock. | api | **PASA** | 1/1 | — |
| CP-08 | CU-13 | Sistema | Cambios registrados con fecha; el salto se bloquea. | api | **PASA** | 1/1 | — |
| CP-09 | CU-05 | Sistema | Llega en tiempo real con su hora. | api + ui | **PASA** | 3/3 | Entrega por WebSocket: p50 10 ms · p95 101 ms (10 mensajes); Mensaje visible en el otro teléfono: 254 ms · 211 ms · 108 ms (p95 254 ms) |
| CP-10 | CU-06 | Sistema | Solo se guarda la primera calificación. | api + ui | **PASA** | 2/2 | — |
| CP-11 | CU-07 | Sistema | Cifras iguales a la suma de los pedidos. | api + ui | **PASA** | 2/2 | — |
| CP-12 | RNF-02 | Usabilidad | ≥ 80 % de éxito y SUS ≥ 68. | Manual | **MANUAL** | — | — |
| CP-13 | CU-10 | Sistema | Catálogo actualizado; con 0 pasa a «Agotada»; los pedidos previos conservan su precio. | api | **PASA** | 1/1 | — |
| CP-14 | CU-15 | Sistema | Aparecen los activos con su estado vigente. | api + ui | **PASA** | 2/2 | — |
| CP-15 | CU-16 | Sistema | El productor recibe la notificación push y, al tocarla, se abre el pedido. | Manual | **MANUAL** | — | — |
| CP-16 | CU-04 · RNF-10 | Integración | 200 con el mismo comprobante; un solo pedido; stock descontado una vez. | api | **PASA** | 1/1 | — |
| CP-17 | CU-17 | Integración | La operación queda «Con error» por conflicto; prevalece el servidor y se informa al usuario. | api + ui | **PASA** | 4/4 | — |
| CP-18 | CU-22 | Sistema | Aprobada: pago aprobado y el productor puede aceptar. Rechazada: se puede reintentar o cambiar a contra entrega. | api | **PASA** | 2/2 | — |
| CP-19 | CU-22 · RNF-04 | Seguridad | El alterado se rechaza (401) sin cambios; el repetido no se procesa dos veces. | api | **PASA** | 1/1 | — |

## Requisitos no funcionales verificados adicionalmente

| RNF | Prueba | Proyecto | Estado |
|---|---|---|---|
| RNF-04 | RNF-04: cabeceras de seguridad, sin X-Powered-By y rutas protegidas exigen JWT | api | PASA |

## Casos que requieren ejecución manual

- **CP-12** (Usuarios de la asociación publican y compran sin ayuda.) → Piloto (docs/piloto/): guion de tareas y cuestionario SUS; npm run sus calcula el puntaje.
- **CP-15** (Confirmar un pedido con la app del productor cerrada.) → Requiere el APK con Firebase en un teléfono. La entrega a FCM, los reintentos y los tokens vencidos se prueban en api/tests/integration/push.test.js.

## Detalle por prueba

| CP | Prueba | Proyecto | Archivo | Estado | Duración |
|---|---|---|---|---|---|
| CP-01 | CP-01: registro con datos válidos y autorización aceptada abre la sesión con su rol | api | `api/cuentas.spec.js` | passed | 0.2 s |
| CP-01 | CP-01 (UI): registrarse como consumidor abre la sesión en el catálogo | ui | `ui/cuenta_catalogo.spec.js` | passed | 4.4 s |
| CP-02 | CP-02: cinco contraseñas incorrectas → mensaje genérico y bloqueo de 15 minutos | api | `api/cuentas.spec.js` | passed | 0.8 s |
| CP-03 | CP-03: el producto publicado queda Activo y aparece en el catálogo con su foto | api | `api/catalogo.spec.js` | passed | 0.6 s |
| CP-04 | CP-04: publicar en modo avión queda «Pendiente» y se publica solo al volver la red | ui | `ui/cuenta_catalogo.spec.js` | passed | 5.4 s |
| CP-05 | CP-05 (API): el filtro por municipio responde solo ese municipio; p95 del servidor ≤ 500 ms con 10 usuarios a la vez | api | `api/catalogo.spec.js` | passed | 1.5 s |
| CP-05 | CP-05 (UI): filtro por municipio con 3G simulado en máximo 3 s | ui | `ui/cuenta_catalogo.spec.js` | passed | 16.2 s |
| CP-06 | CP-06: con stock suficiente se descuenta, queda «Pendiente» y el productor recibe el aviso | api | `api/pedidos.spec.js` | passed | 0.4 s |
| CP-07 | CP-07: dos consumidores compran a la vez la última unidad; solo uno lo logra | api | `api/pedidos.spec.js` | passed | 0.6 s |
| CP-08 | CP-08: avanza por todos los estados con fecha y el salto se bloquea | api | `api/pedidos.spec.js` | passed | 0.5 s |
| CP-09 | CP-09: el mensaje llega en tiempo real con su hora | api | `api/comunicacion.spec.js` | passed | 1.1 s |
| CP-09 | CU-05: un tercero no lee el chat y con el pedido entregado queda en solo lectura | api | `api/comunicacion.spec.js` | passed | 0.6 s |
| CP-09 | CP-09 (UI): el mensaje llega en tiempo real al otro teléfono con su hora | ui | `ui/pedidos_comunicacion.spec.js` | passed | 5.7 s |
| CP-10 | CP-10: calificar dos veces el mismo pedido entregado guarda solo la primera | api | `api/comunicacion.spec.js` | passed | 0.5 s |
| CP-10 | CP-10 (UI): calificar un pedido entregado; la segunda calificación no se guarda | ui | `ui/pedidos_comunicacion.spec.js` | passed | 3.6 s |
| CP-11 | CP-11: las cifras del mes son iguales a la suma de los pedidos entregados | api | `api/comunicacion.spec.js` | passed | 1.6 s |
| CP-11 | CP-11 (UI): el panel muestra cifras iguales a la suma de los pedidos entregados | ui | `ui/pedidos_comunicacion.spec.js` | passed | 2.1 s |
| CP-13 | CP-13: editar precio y cantidad; con 0 pasa a Agotada y sale del catálogo; el pedido previo conserva su precio | api | `api/catalogo.spec.js` | passed | 0.6 s |
| CP-14 | CP-14: aparecen los pedidos activos con su estado vigente | api | `api/pedidos.spec.js` | passed | 0.8 s |
| CP-14 | CP-14 (UI): «Mis pedidos» muestra los activos con su estado vigente y se actualiza en vivo | ui | `ui/pedidos_comunicacion.spec.js` | passed | 2.1 s |
| CP-16 | CP-16: reenviar con la misma Idempotency-Key devuelve el mismo comprobante y descuenta una vez | api | `api/pedidos.spec.js` | passed | 0.5 s |
| CP-17 | CP-17: edición sin conexión con versión vieja → «Con error»; prevalece el servidor | api | `api/sincronizacion.spec.js` | passed | 0.2 s |
| CP-17 | RNF-03: una operación válida se aplica una sola vez aunque se reenvíe | api | `api/sincronizacion.spec.js` | passed | 0.3 s |
| CP-17 | CU-17 paso 4: /sync/pull trae lo cambiado desde la última marca | api | `api/sincronizacion.spec.js` | passed | 0.2 s |
| CP-17 | CP-17 (UI): editar sin conexión mientras cambia la versión → «Con error» y prevalece el servidor | ui | `ui/pedidos_comunicacion.spec.js` | passed | 4.6 s |
| CP-18 | CP-18 (aprobada): el pago queda aprobado y el productor puede aceptar | api | `api/pagos.spec.js` | passed | 0.6 s |
| CP-18 | CP-18 (rechazada): se puede reintentar con otra referencia o cambiar a contra entrega | api | `api/pagos.spec.js` | passed | 0.7 s |
| CP-19 | CP-19: firma alterada → 401 sin cambios; evento repetido → no se reprocesa | api | `api/pagos.spec.js` | passed | 0.5 s |

_Generado por `e2e/reportero-cp.js`. Evidencias (trazas y capturas de las fallas) en `informe-html/`._
