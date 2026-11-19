# Informe de pruebas de sistema · AgroTech v1.1.0 (MVP + Fase 2 del SRS)

- **Fecha:** 2026-11-19 02:13 UTC
- **Entorno:** local (API y app web levantadas por Playwright) · API `http://localhost:3999` · Web `http://localhost:8090`
- **Resultado global de la ejecución:** passed · duración 173.6 s
- **Casos:** 30 · PASA 28 · FALLA 0 · MANUAL 2 · OMITIDO 0 · SIN PRUEBA 0

## Matriz de trazabilidad

| CP | CU / RNF | Tipo | Resultado esperado | Ejecución | Veredicto | Pruebas | Mediciones |
|---|---|---|---|---|---|---|---|
| CP-01 | CU-01 | Sistema | Cuenta creada con su rol; sesión abierta. | api + ui | **PASA** | 2/2 | — |
| CP-02 | CU-01 | Seguridad | Mensaje genérico y bloqueo de 15 minutos. | api | **PASA** | 1/1 | Bloqueo de 15.0 min tras el 5.º intento |
| CP-03 | CU-02 | Sistema | Producto "Activo" visible en el catálogo. | api | **PASA** | 1/1 | — |
| CP-04 | CU-02, CU-17 | Sistema | Queda "Pendiente" y se publica solo al volver la red. | ui | **PASA** | 1/1 | Publicada 1.0 s después de volver la señal |
| CP-05 | CU-03 | Rendimiento | Solo productos de ese municipio, en máximo 3 s. | api + ui | **PASA** | 2/2 | 100 consultas (10 concurrentes): p95 = 290 ms · respuesta JSON 4 KB; 3G (562 ms, 1,44 Mbps): 0.93 s · 0.98 s · 0.97 s · 0.84 s · 0.97 s → p95 0.98 s (umbral 3 s) |
| CP-06 | CU-04 | Sistema | Stock descontado, pedido "Pendiente" y aviso al productor. | api | **PASA** | 1/1 | Aviso «pedido_nuevo» al productor en 14 ms |
| CP-07 | CU-04 | Integración | Solo se crea un pedido; el otro recibe el aviso de stock. | api | **PASA** | 1/1 | — |
| CP-08 | CU-13 | Sistema | Cambios registrados con fecha; el salto se bloquea. | api | **PASA** | 1/1 | — |
| CP-09 | CU-05 | Sistema | Llega en tiempo real con su hora. | api + ui | **PASA** | 3/3 | Entrega por WebSocket: p50 11 ms · p95 18 ms (10 mensajes); Mensaje visible en el otro teléfono: 128 ms · 202 ms · 183 ms (p95 202 ms) |
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
| CP-20 | CU-08 | Seguridad | Mensaje neutro; código de un solo uso (15 min, 3 intentos); nueva contraseña y sesiones anteriores cerradas. | api + ui | **PASA** | 2/2 | — |
| CP-21 | CU-09 | Sistema | Datos guardados con coordenadas recalculadas y bitácora; celular en uso y cambio de rol rechazados. | api + ui | **PASA** | 2/2 | — |
| CP-22 | CU-20 | Privacidad | Con pedidos en curso queda aplazada; sin ellos la cuenta se anonimiza, se cierra la sesión y los pedidos se conservan sin identificación. | api + ui | **PASA** | 2/2 | — |
| CP-23 | CU-10 | Sistema | Pausada no aparece en el catálogo; retirar con pedidos en curso se bloquea; retirada conserva el histórico. | api + ui | **PASA** | 2/2 | — |
| CP-24 | CU-11 | Sistema | Encuentra en nombre y descripción sin distinguir tildes; respeta el orden y los filtros; sin resultados sugiere categorías. | api + ui | **PASA** | 2/2 | Búsqueda «cafe» respondió en 8 ms; Resultados de la búsqueda visibles en 284 ms |
| CP-25 | CU-12 | Sistema | Ordena de menor a mayor distancia mostrando los km; el radio filtra y propone ampliarlo. | api + ui | **PASA** | 2/2 | Distancias desde Ocaña: Ocaña 0.7 km · Pamplona 123 km |
| CP-26 | CU-14 | Integración | Inventario restituido una sola vez, historial con motivo, chat en solo lectura, aviso a la contraparte; el entregado no se cancela. | api + ui | **PASA** | 2/2 | — |
| CP-27 | CU-15 | Sistema | Pedidos del más reciente al más antiguo según el filtro, con detalle, historial y acciones disponibles. | api + ui | **PASA** | 2/2 | — |
| CP-28 | CU-16 | Sistema | Cada aviso llega en tiempo real y queda en la bandeja con lo necesario para abrir el pedido o el chat. | api + ui | **PASA** | 2/2 | Tres avisos entregados por WebSocket en 67 ms |
| CP-29 | CU-19 | Sistema | Reporte «Pendiente»; el repetido se informa en trámite; «Otro» exige descripción. | api + ui | **PASA** | 2/2 | — |
| CP-30 | CU-18 | Seguridad | Medida aplicada, registrada en bitácora y notificada; la suspensión pide confirmación y cierra la sesión; el acceso sin rol se niega y se registra. | api + ui | **PASA** | 2/2 | — |

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
| CP-01 | CP-01: registro con datos válidos y autorización aceptada abre la sesión con su rol | api | `api\cuentas.spec.js` | passed | 0.3 s |
| CP-01 | CP-01 (UI): registrarse como consumidor abre la sesión en el catálogo | ui | `ui\cuenta_catalogo.spec.js` | passed | 6.4 s |
| CP-02 | CP-02: cinco contraseñas incorrectas → mensaje genérico y bloqueo de 15 minutos | api | `api\cuentas.spec.js` | passed | 1.1 s |
| CP-03 | CP-03: el producto publicado queda Activo y aparece en el catálogo con su foto | api | `api\catalogo.spec.js` | passed | 0.7 s |
| CP-04 | CP-04: publicar en modo avión queda «Pendiente» y se publica solo al volver la red | ui | `ui\cuenta_catalogo.spec.js` | passed | 8.0 s |
| CP-05 | CP-05 (API): el filtro por municipio responde solo ese municipio; p95 del servidor ≤ 500 ms con 10 usuarios a la vez | api | `api\catalogo.spec.js` | passed | 3.4 s |
| CP-05 | CP-05 (UI): filtro por municipio con 3G simulado en máximo 3 s | ui | `ui\cuenta_catalogo.spec.js` | passed | 18.3 s |
| CP-06 | CP-06: con stock suficiente se descuenta, queda «Pendiente» y el productor recibe el aviso | api | `api\pedidos.spec.js` | passed | 0.3 s |
| CP-07 | CP-07: dos consumidores compran a la vez la última unidad; solo uno lo logra | api | `api\pedidos.spec.js` | passed | 0.6 s |
| CP-08 | CP-08: avanza por todos los estados con fecha y el salto se bloquea | api | `api\pedidos.spec.js` | passed | 0.4 s |
| CP-09 | CP-09: el mensaje llega en tiempo real con su hora | api | `api\comunicacion.spec.js` | passed | 0.6 s |
| CP-09 | CU-05: un tercero no lee el chat y con el pedido entregado queda en solo lectura | api | `api\comunicacion.spec.js` | passed | 0.7 s |
| CP-09 | CP-09 (UI): el mensaje llega en tiempo real al otro teléfono con su hora | ui | `ui\pedidos_comunicacion.spec.js` | passed | 6.3 s |
| CP-10 | CP-10: calificar dos veces el mismo pedido entregado guarda solo la primera | api | `api\comunicacion.spec.js` | passed | 0.6 s |
| CP-10 | CP-10 (UI): calificar un pedido entregado; la segunda calificación no se guarda | ui | `ui\pedidos_comunicacion.spec.js` | passed | 5.7 s |
| CP-11 | CP-11: las cifras del mes son iguales a la suma de los pedidos entregados | api | `api\comunicacion.spec.js` | passed | 0.8 s |
| CP-11 | CP-11 (UI): el panel muestra cifras iguales a la suma de los pedidos entregados | ui | `ui\pedidos_comunicacion.spec.js` | passed | 4.0 s |
| CP-13 | CP-13: editar precio y cantidad; con 0 pasa a Agotada y sale del catálogo; el pedido previo conserva su precio | api | `api\catalogo.spec.js` | passed | 0.7 s |
| CP-14 | CP-14: aparecen los pedidos activos con su estado vigente | api | `api\pedidos.spec.js` | passed | 0.7 s |
| CP-14 | CP-14 (UI): «Mis pedidos» muestra los activos con su estado vigente y se actualiza en vivo | ui | `ui\pedidos_comunicacion.spec.js` | passed | 4.0 s |
| CP-16 | CP-16: reenviar con la misma Idempotency-Key devuelve el mismo comprobante y descuenta una vez | api | `api\pedidos.spec.js` | passed | 0.5 s |
| CP-17 | CP-17: edición sin conexión con versión vieja → «Con error»; prevalece el servidor | api | `api\sincronizacion.spec.js` | passed | 0.2 s |
| CP-17 | RNF-03: una operación válida se aplica una sola vez aunque se reenvíe | api | `api\sincronizacion.spec.js` | passed | 0.2 s |
| CP-17 | CU-17 paso 4: /sync/pull trae lo cambiado desde la última marca | api | `api\sincronizacion.spec.js` | passed | 0.4 s |
| CP-17 | CP-17 (UI): editar sin conexión mientras cambia la versión → «Con error» y prevalece el servidor | ui | `ui\pedidos_comunicacion.spec.js` | passed | 6.3 s |
| CP-18 | CP-18 (aprobada): el pago queda aprobado y el productor puede aceptar | api | `api\pagos.spec.js` | passed | 0.5 s |
| CP-18 | CP-18 (rechazada): se puede reintentar con otra referencia o cambiar a contra entrega | api | `api\pagos.spec.js` | passed | 0.5 s |
| CP-19 | CP-19: firma alterada → 401 sin cambios; evento repetido → no se reprocesa | api | `api\pagos.spec.js` | passed | 0.4 s |
| CP-20 | CP-20: código por correo de un solo uso; errado, débil y sesiones anteriores cerradas | api | `api\fase2.spec.js` | passed | 0.7 s |
| CP-20 | CP-20 (UI): recuperar la contraseña con el código del correo y entrar con la nueva | ui | `ui\fase2.spec.js` | passed | 6.4 s |
| CP-21 | CP-21: actualiza contacto y ubicación; celular en uso y cambio de rol se rechazan | api | `api\fase2.spec.js` | passed | 0.6 s |
| CP-21 | CP-21 (UI): editar el perfil; el celular de otra cuenta se marca en el campo | ui | `ui\fase2.spec.js` | passed | 8.0 s |
| CP-22 | CP-22: supresión aplazada con pedidos en curso; sin ellos anonimiza y conserva la transacción | api | `api\fase2.spec.js` | passed | 0.8 s |
| CP-22 | CP-22 (UI): consultar mis datos y pedir que los borren; la sesión se cierra | ui | `ui\fase2.spec.js` | passed | 8.6 s |
| CP-23 | CP-23: pausar oculta; retirar con pedido en curso se bloquea; retirar conserva el histórico | api | `api\fase2.spec.js` | passed | 0.5 s |
| CP-23 | CP-23 (UI): pausar y reactivar una publicación desde «Mis productos» | ui | `ui\fase2.spec.js` | passed | 6.3 s |
| CP-24 | CP-24: búsqueda sin tildes en nombre y descripción, orden por precio y sugerencias | api | `api\fase2.spec.js` | passed | 0.4 s |
| CP-24 | CP-24 (UI): buscar sin tildes, ordenar por precio y recibir sugerencias | ui | `ui\fase2.spec.js` | passed | 6.9 s |
| CP-25 | CP-25: «Cerca de mí» ordena por distancia con el GPS o el perfil y respeta el radio | api | `api\fase2.spec.js` | passed | 0.5 s |
| CP-25 | CP-25 (UI): «Cerca de mí» muestra primero lo más cercano con los km y filtra por radio | ui | `ui\fase2.spec.js` | passed | 7.8 s |
| CP-26 | CP-26: cancelar un pedido aceptado restituye el inventario una vez; el entregado no se cancela | api | `api\fase2.spec.js` | passed | 0.6 s |
| CP-26 | CP-26 (UI): el consumidor cancela un pedido aceptado y el productor recibe el aviso | ui | `ui\fase2.spec.js` | passed | 10.3 s |
| CP-27 | CP-27: historial con filtros de estado y fechas, del más reciente al más antiguo | api | `api\fase2.spec.js` | passed | 0.5 s |
| CP-27 | CP-27 (UI): «Mis pedidos» separa activos y finalizados y filtra por periodo | ui | `ui\fase2.spec.js` | passed | 6.1 s |
| CP-28 | CP-28: aceptar, escribir y cancelar llegan en tiempo real y quedan en la bandeja | api | `api\fase2.spec.js` | passed | 0.5 s |
| CP-28 | CP-28 (UI): los avisos quedan en la bandeja y el del mensaje abre el chat | ui | `ui\fase2.spec.js` | passed | 6.9 s |
| CP-29 | CP-29: reportar una publicación; el repetido está en trámite y «Otro» exige descripción | api | `api\fase2.spec.js` | passed | 0.3 s |
| CP-29 | CP-29 (UI): reportar una publicación; «Otro» exige descripción y el repetido queda en trámite | ui | `ui\fase2.spec.js` | passed | 7.3 s |
| CP-30 | CP-30: el administrador oculta lo reportado y suspende con confirmación; un no administrador no entra | api | `api\fase2.spec.js` | passed | 0.8 s |
| CP-30 | CP-30 (UI): el administrador revisa el reporte en el panel web y oculta la publicación | ui | `ui\fase2.spec.js` | passed | 8.9 s |

_Generado por `e2e/reportero-cp.js`. Evidencias (trazas y capturas de las fallas) en `informe-html/`._
