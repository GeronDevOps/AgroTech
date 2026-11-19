# Plan y diseño de pruebas de software · AgroTech 1.1.1

| Campo | Valor |
|---|---|
| Versión del documento | 1.0 · 18 de noviembre de 2026 |
| Sistema bajo prueba | AgroTech 1.1.1 (API 1.1.1, app 1.1.1, migraciones 001–006) · commit `2d85ae6` |
| Norma de referencia | Estructura basada en IEEE 829 / ISO/IEC/IEEE 29119-3 (plan, diseño y casos); defectos según IEEE 1044 |
| Cronograma | EDT 5.5 (plan inicial, 09/10), 6.1 (pruebas del sistema y de aceptación, 17–19/11), 6.2 (corrección, 20–24/11), 6.4 (piloto, 26/11–01/12), 6.7–6.9 (revisión, QA y E2E, 18–20/11). Ver [GESTION_PROJECTLIBRE_COSTOS.md](../GESTION_PROJECTLIBRE_COSTOS.md) |
| Responsables (RACI) | QA y aprobación de pruebas: Julio Durán (Frontend / QA Tester) · Diseño y ejecución técnica: Julio Carrillo (PM / Arquitecto) · Entornos y correcciones de backend: Geron Vergara (Backend / DevOps) |
| Documentos relacionados | [INFORME_EJECUCION_PRUEBAS.md](INFORME_EJECUCION_PRUEBAS.md) · [INFORME_PRUEBAS_SISTEMA.md](INFORME_PRUEBAS_SISTEMA.md) (CP-01…CP-30) · [BANCO_PRUEBAS.md](BANCO_PRUEBAS.md) (BP-001…BP-103) · [REGISTRO_DE_ERRORES.md](REGISTRO_DE_ERRORES.md) · [RESUMEN_REVISION_CODIGO.md](../../RESUMEN_REVISION_CODIGO.md) · Entrega 4 (plan SQA, capítulo 5) |

Este plan reúne en un solo documento lo que la Entrega 4 (plan SQA) y la Entrega 5 (pruebas del sistema v1.1.0) dejaron definido, y lo actualiza a la versión 1.1.1 con los casos nuevos de la revisión de código final (ERR-16 y ERR-17).

## 1. Alcance

### 1.1 Dentro del alcance

| Componente | Qué se prueba |
|---|---|
| API REST (`api/`) | 16 módulos en `api/src/modules/`: 15 con rutas HTTP (`auth` cuentas, `perfil`, `privacidad`, `productos` publicaciones y catálogo, `pedidos`, `pagos` Wompi, `mensajes` chat, `calificaciones`, `ventas`, `dispositivos`, `notificaciones` avisos, `reportes`, `admin` administración, `sync` sincronización, `salud`) más `correo` (transversal, sin rutas). `routes.js` los expone en 17 montajes bajo `/api/v1` porque `mensajes` y `calificaciones` también se montan anidados en `/pedidos/:id/…` |
| Tiempo real | Servidor WebSocket `/ws`: eventos de pedido, mensajes del chat y avisos |
| Base de datos | Migraciones 001–006 (PostgreSQL 17 + PostGIS 3.5), restricciones de integridad, disparador de estados del pedido, concurrencia |
| App móvil (`app/`) | Pantallas por rol (consumidor, productor, administrador), base local SQLite, cola y motor de sincronización sin conexión, sesión segura, avisos |
| Requisitos | RF-01 a RF-21 y RNF-01 a RNF-10 del SRS (Entrega 1); criterios de aceptación CA-01 a CA-17 (Entrega 2) |

### 1.2 Fuera del alcance (y por qué)

| Elemento | Motivo | Cómo se cubre |
|---|---|---|
| Checkout real de Wompi | Requiere URL pública y cuenta de comercio | Eventos firmados con el secreto de pruebas (CP-18, CP-19); prueba de humo en AWS |
| Push con la app cerrada (FCM) | Expo Go no entrega push remoto en Android; requiere el APK con Firebase | CP-15 manual en el piloto; `api/tests/integration/push.test.js` cubre FCM simulado |
| Infraestructura AWS en ejecución | La creación real de la pila depende de la cuenta de AWS | `cfn-lint`, `shellcheck` y `actionlint` en CI; RUNBOOK |
| Pruebas de carga masiva | Piloto con una sola asociación | CP-05 y BP-084 miden p95 con 10 usuarios concurrentes |

## 2. Objetivos

1. Verificar que cada RF del SRS cumple sus criterios de aceptación (trazabilidad completa RF → caso → resultado).
2. Comprobar los RNF medibles: catálogo ≤ 3 s en 3G (RNF-01), SUS ≥ 68 y ≥ 80 % de éxito en tareas (RNF-02), ≥ 98 % de operaciones sincronizadas sin error (RNF-03), seguridad (RNF-04), tratamiento de datos según la Ley 1581 de 2012 (RNF-05), idempotencia (RNF-10).
3. Garantizar el funcionamiento sin conexión (RF-17): las operaciones hechas sin señal se envían solas, una sola vez, y los conflictos los resuelve el servidor.
4. Evitar regresiones: toda corrección de la bitácora de errores (ERR-xx) queda cubierta por al menos una prueba automática.
5. Dejar evidencia reproducible (comandos, entorno, informes generados) para la entrega académica y la aceptación del cliente.

## 3. Estrategia y niveles de prueba

| Nivel | Técnica | Herramienta | Ubicación | Cuándo se ejecuta |
|---|---|---|---|---|
| Unitarias | Caja blanca | Jest 30 | `api/tests/unit/` (11 suites) | Cada Pull Request (CI) y antes de cada commit |
| Integración API + BD | Caja gris (supertest contra PostgreSQL real) | Jest 30 + supertest | `api/tests/integration/` (18 suites) | Cada Pull Request (CI, servicio `postgis/postgis:17-3.5`) |
| Componentes y pantallas de la app | Caja gris (router real, red y SQLite simulados) | jest-expo 58 + Testing Library 14 | `app/__tests__/` (9 suites) | Cada Pull Request |
| Sistema (CP) | Caja negra | Playwright 1.56 (`request`, `ws`, Chromium Pixel 7) | `e2e/api`, `e2e/ui` | PR hacia `main`, cada noche y antes de desplegar (`e2e.yml`) |
| Banco de pruebas (BP) | Caja negra: partición de equivalencia, valores límite, tabla de decisión, transición de estados, flujo de CU, conjetura de errores, seguridad, rendimiento, concurrencia | Playwright 1.56 | `e2e/banco` | Antes de cada versión (3 repeticiones para estabilidad) |
| Aceptación y usabilidad | Pruebas con usuarios | Guion de tareas + SUS (Brooke, 1996) | `docs/piloto/` | Piloto 26/11–01/12 (EDT 6.4) |
| Análisis estático | Revisión automática | ESLint 10 (API), `expo lint` (app) | — | Cada Pull Request |

## 4. Entorno de pruebas

| Elemento | Configuración |
|---|---|
| Backend | Node.js 22 (CI, `engines >=22`) · ejecución local del 18/11 con Node 24.22 de Windows · Express 5.3 · `NODE_ENV=test` |
| Base de datos | PostgreSQL 17 + PostGIS 3.5 en Docker, **puerto 5434** del equipo (`api/.env`): bases `agrotech` (desarrollo), `agrotech_test` (Jest) y `agrotech_e2e` (Playwright). En CI, servicio en el puerto 5432 |
| App móvil | Expo **SDK 58** (React Native 0.88, React 19.3, expo-router 58 con `asyncRoutes: false`) · Expo Go en Android, misma red Wi-Fi que el computador, `EXPO_PUBLIC_API_URL=auto` · APK con EAS (perfil `piloto`) para push |
| Pruebas de la app | jest-expo 58, `testTimeout` 30 s (ERR-15), SQLite real de Node en memoria (`jest/sqliteNode.js`), red conmutable (`jest/redSimulada.js`), WebSocket simulado (`jest/wsSimulado.js`) |
| E2E | Playwright 1.56: API en `http://localhost:3999`, vista web en `http://localhost:8090`; 3G simulado por CDP (562 ms, 1,44 Mbps); modo avión con `setOffline`; correo con driver `archivo` (buzón en disco) |
| Datos de prueba | Cada prueba crea sus propios usuarios, productos y pedidos (sin dependencias entre casos). Contraseñas y secretos de prueba fijos solo con `NODE_ENV=test` |
| Integración continua | GitHub Actions: `ci.yml` (lint, migrate, test), `e2e.yml` (sistema), `desplegar.yml` (AWS con OIDC) |

**Restricción del equipo local (registrada en la revisión del 18/11):** el repositorio está en OneDrive bajo `/mnt/c` y `node_modules` se instaló desde Windows (Jest 30 solo trae su binario nativo `win32-x64`). Las pruebas se ejecutan con el Node de Windows, una suite a la vez (`--runInBand`), sin modos `--watch`. PostgreSQL en 5434 solo es accesible desde Windows.

## 5. Criterios

### 5.1 Criterios de entrada

- Código integrado en la rama a probar, con lint sin errores.
- Base de datos migrada hasta la 006 (la API aplica las pendientes al arrancar; `AUTO_MIGRAR`).
- `api/.env` con `DATABASE_URL_TEST`; para E2E, `npm ci` en `e2e/`, `npx playwright install chromium` y `npm run preparar`.
- Casos de prueba diseñados y trazados a un RF/RNF (sección 7).

### 5.2 Criterios de salida (para liberar la versión final, EDT 6.3)

| Criterio | Meta |
|---|---|
| Pruebas automáticas de la API (Jest) | 100 % en verde |
| Pruebas automáticas de la app (Jest) | 100 % en verde |
| Casos de sistema CP-01…CP-30 automatizados | 100 % PASA; solo CP-12 y CP-15 pueden quedar MANUAL |
| Banco BP-001…BP-100 | 100 % PASA en 3 repeticiones; BP-101…BP-103 en el piloto |
| Defectos abiertos | 0 de severidad Alta o Media sin corregir (REGISTRO_DE_ERRORES.md) |
| Cobertura de la API | ≥ 90 % de líneas (línea base de la Entrega 5: 95,67 %) |
| Cobertura de la app | ≥ 80 % de líneas |
| Usabilidad (piloto) | SUS ≥ 68 y ≥ 80 % de éxito en tareas críticas (CP-12) |

### 5.3 Suspensión y reanudación

Se suspende la ejecución si falla el arranque del entorno (PostgreSQL apagado, migración bloqueada) o si más del 20 % de una suite falla por la misma causa (síntoma de entorno, como ERR-15). Se reanuda cuando la causa queda registrada en la bitácora y corregida; la suite completa se repite desde el principio.

## 6. Técnicas de diseño aplicadas

| Técnica | Ejemplos |
|---|---|
| Partición de equivalencia | Registro válido / correo duplicado (BP-001, BP-003); orden conocido / desconocido (BP-041, BP-042) |
| Valores límite | Precio $50 y $50.000.000 (BP-026, BP-027); 5.º intento fallido (CP-02); foto de 300 KB (CP-32) |
| Tabla de decisión | Supresión con o sin pedidos en curso (CP-22); retirar con pedidos en curso (CP-23, BP-036) |
| Transición de estados | Pedido PENDIENTE → ACEPTADO → … → ENTREGADO y salto bloqueado (CP-08) |
| Flujo de caso de uso | Publicar sin señal y sincronizar (CP-04); recuperar contraseña (CP-20) |
| Concurrencia | Última unidad comprada a la vez (CP-07); cancelaciones simultáneas (BP-057) |
| Conjetura de errores | Claves heredadas de `Object.prototype` como periodo (CP-31); idempotencia (CP-16) |
| Seguridad | Firma de Wompi alterada (CP-19); acceso al panel sin rol (CP-30); inyección SQL (BP-086) |

## 7. Matriz de casos de prueba

**Tipos:** F = funcional · I = integración · API = contrato REST · S = sincronización sin conexión · TR = tiempo real (WebSocket) · SEG = seguridad · PRIV = privacidad (Ley 1581) · U = usabilidad · R = rendimiento.
**Automatización:** dónde está automatizado el caso; «Manual» indica que requiere personas o un teléfono real.

| ID | Módulo / CU | Tipo | Precondiciones | Pasos | Datos de entrada | Resultado esperado | Automatización |
|---|---|---|---|---|---|---|---|
| CP-01 | Cuentas · CU-01 (RF-01) | F, API | API y BD activas; correo y celular sin registrar | 1. Abrir «Crear cuenta». 2. Llenar los datos y elegir el rol. 3. Aceptar la autorización de datos. 4. Registrarse | Rosa Pérez, `rosa@correo.co`, 310 555 1234, Pamplonita, PRODUCTOR, contraseña `cosecha2026` | 201; cuenta creada con su rol; sesión abierta en el inicio del rol | `e2e/api/cuentas.spec.js`, `e2e/ui/cuenta_catalogo.spec.js`, `api/tests/integration/auth.test.js` |
| CP-02 | Cuentas · CU-21 | SEG | Cuenta existente | 1. Iniciar sesión 5 veces con contraseña errada. 2. Intentar con la correcta | `rosa@correo.co` / `mala12345` ×5, luego `cosecha2026` | 401 con mensaje genérico en los 4 primeros; 423 `CUENTA_BLOQUEADA` con bloqueo de 15 min (tolerancia de reloj ≤ 5 s, ERR-14); la correcta también recibe 423 | `e2e/api/cuentas.spec.js`, `auth.test.js` |
| CP-03 | Inventario · CU-02 (RF-02) | F, API | Productor autenticado | 1. Tomar foto. 2. Elegir producto, cantidad y precio. 3. Publicar | Papa pastusa, 20 bultos, $85.000/bulto, foto JPEG ≤ 300 KB + miniatura | Publicación «Activa» visible en el catálogo con foto y miniatura | `e2e/api/catalogo.spec.js`, `productos.test.js` |
| CP-04 | Inventario + sincronización · CU-02, CU-17 (RF-17) | S | Productor autenticado; app en modo avión | 1. Publicar sin señal. 2. Ver «Pendiente por sincronizar». 3. Activar la red | Mismos datos de CP-03 | Queda «Pendiente»; al volver la red se publica sola con el mismo id (sin duplicar) | `e2e/ui/cuenta_catalogo.spec.js`, `app/__tests__/sincronizacion.test.js` |
| CP-05 | Catálogo · CU-03 (RF-03, RNF-01) | R, F | Productos en varios municipios | 1. Filtrar por municipio con 3G simulado. 2. Medir el tiempo hasta ver los resultados | Municipio Ocaña; 3G 562 ms / 1,44 Mbps; 10 usuarios concurrentes | Solo productos de Ocaña; ≤ 3 s en la pantalla; p95 del servidor ≤ 500 ms | `e2e/api/catalogo.spec.js`, `e2e/ui/cuenta_catalogo.spec.js` |
| CP-06 | Pedidos · CU-04 (RF-04) | F, TR | Consumidor con carrito; stock suficiente; productor conectado al WebSocket | 1. Confirmar el pedido | 2 bultos de papa, punto «Parque principal», franja «Mañana» | Stock descontado; pedido «Pendiente»; aviso `pedido_nuevo` al productor por `/ws` | `e2e/api/pedidos.spec.js`, `pedidos.test.js` |
| CP-07 | Pedidos · CU-04 | I | Producto con 1 unidad | 1. Dos consumidores confirman a la vez | 2 peticiones simultáneas de 1 unidad | Solo se crea un pedido; el otro recibe el aviso de stock insuficiente (409) | `e2e/api/pedidos.spec.js` |
| CP-08 | Pedidos · CU-13 (RF-13) | F, I | Pedido «Pendiente» | 1. Avanzar por todos los estados. 2. Intentar saltar uno | Aceptar → En preparación → Listo → Entregado; salto Pendiente → Entregado | Cada cambio con fecha en el historial; el salto se rechaza (409 `TRANSICION_NO_PERMITIDA`) | `e2e/api/pedidos.spec.js` |
| CP-09 | Chat · CU-05 (RF-05) | TR | Pedido activo; ambas partes conectadas | 1. Enviar un mensaje. 2. Verlo en el otro teléfono | «¿Lo puedo recoger a las 8?» | Llega en tiempo real con su hora (p95 < 2 s por API, < 3 s pantalla a pantalla); un tercero no lo lee | `e2e/api/comunicacion.spec.js`, `e2e/ui/pedidos_comunicacion.spec.js`, `tiempoReal.test.js` |
| CP-10 | Calificaciones · CU-06 (RF-06) | F | Pedido entregado | 1. Calificar. 2. Calificar otra vez | 5 estrellas + comentario; luego 1 estrella | Solo se guarda la primera calificación | `e2e/api/comunicacion.spec.js`, `e2e/ui/pedidos_comunicacion.spec.js` |
| CP-11 | Ventas · CU-07 (RF-07) | F | Productor con pedidos entregados en el mes | 1. Abrir el panel de ventas | Periodo «Este mes» | Ingresos y pedidos iguales a la suma de los pedidos entregados | `e2e/api/comunicacion.spec.js`, `ventas.test.js` |
| CP-12 | Usabilidad · RNF-02 | U | APK instalado; participantes con consentimiento firmado | 1. Ejecutar el guion de tareas. 2. Aplicar el SUS | 5 productores y 5 consumidores de la asociación | ≥ 80 % de éxito en tareas críticas; SUS ≥ 68 | **Manual** (piloto, `docs/piloto/`, `npm run piloto:informe`) |
| CP-13 | Inventario · CU-10 (RF-10a) | F | Publicación activa con un pedido previo | 1. Editar precio y cantidad. 2. Llevar la cantidad a 0 | $90.000; cantidad 0 | Catálogo actualizado; con 0 pasa a «Agotada»; el pedido previo conserva su precio | `e2e/api/catalogo.spec.js` |
| CP-14 | Pedidos · CU-15 (RF-15a) | F, TR | Consumidor con pedidos en varios estados | 1. Abrir «Mis pedidos» | — | Aparecen los activos con su estado vigente; se actualiza en vivo | `e2e/api/pedidos.spec.js`, `e2e/ui/pedidos_comunicacion.spec.js` |
| CP-15 | Avisos · CU-16 (RF-16a) | TR | APK con Firebase; app del productor cerrada | 1. Confirmar un pedido desde otro teléfono. 2. Tocar la notificación | — | Llega la notificación push y al tocarla se abre el pedido | **Manual** (piloto); FCM simulado en `push.test.js` |
| CP-16 | Pedidos · CU-04 (RNF-10) | I, API | Consumidor con carrito | 1. `POST /pedidos`. 2. Reenviar con la misma `Idempotency-Key` | Misma clave UUID | 200 con el mismo comprobante; un solo pedido; stock descontado una vez | `e2e/api/pedidos.spec.js` |
| CP-17 | Sincronización · CU-17 (RF-17, RNF-03) | S, I | Publicación editada sin conexión; la versión cambia en el servidor | 1. Editar sin señal. 2. Otro cambio en el servidor. 3. Reconectar | Precio $95.000 en el servidor; $90.000 en el teléfono | La operación queda «Con error» por conflicto; prevalece el servidor; se puede descartar. Una operación válida reenviada se aplica una vez | `e2e/api/sincronizacion.spec.js`, `e2e/ui/pedidos_comunicacion.spec.js`, `sync.test.js`, `app/__tests__/sincronizacion.test.js` |
| CP-18 | Pagos · CU-22 (RF-21) | I | Pedido con pago en línea | 1. Pagar con la tarjeta aprobada. 2. Con la rechazada | Eventos `APPROVED` / `DECLINED` firmados con el secreto de eventos | Aprobada: pago aprobado y el productor puede aceptar. Rechazada: reintento o cambio a contra entrega | `e2e/api/pagos.spec.js` (requiere `E2E_WOMPI_SECRETO_EVENTOS`), `pagos.test.js` |
| CP-19 | Pagos · CU-22 (RNF-04) | SEG | Evento de pago válido | 1. Enviar con firma alterada. 2. Repetir uno válido | Firma SHA-256 modificada | Alterado → 401 sin cambios; repetido → no se reprocesa | `e2e/api/pagos.spec.js`, `pagos.test.js` |
| CP-20 | Cuentas · CU-08 (RF-08) | SEG | Cuenta con 2 sesiones abiertas | 1. Pedir el código. 2. Probar código errado ×3, vencido y contraseña débil. 3. Restablecer | Código de 6 dígitos del buzón; contraseña `cosecha2027` | Respuesta neutra; código de un solo uso (15 min, 3 intentos); nueva contraseña; sesiones anteriores → 401 | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js`, `fase2/cuentas.test.js` |
| CP-21 | Perfil · CU-09 (RF-09) | F | Consumidor autenticado | 1. Cambiar celular, municipio y ubicación. 2. Usar un celular de otra cuenta. 3. Intentar cambiar el rol | Municipio Ocaña; GPS 7,3756 / −72,6478; celular de otra cuenta | Datos guardados, coordenadas recalculadas y bitácora; celular en uso (409 `DATO_EN_USO`) y cambio de rol rechazados | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js`, `app/__tests__/fase2.test.js` |
| CP-22 | Privacidad · CU-20 (RF-20, RNF-05) | PRIV | Cuenta con y sin pedidos en curso | 1. Consultar datos y autorización. 2. Solicitar la supresión confirmando consecuencias | Motivo opcional; `confirmar: true` | Con pedidos en curso queda aplazada; sin ellos se anonimiza, se cierra la sesión y los pedidos se conservan sin identificación | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js`, `fase2/perfil_privacidad.test.js` |
| CP-23 | Inventario · CU-10 (RF-10) | F | Publicación activa; otra con pedido en curso | 1. Pausar. 2. Reactivar. 3. Retirar la que tiene pedido en curso | Acciones `PAUSAR`, `REACTIVAR`, `RETIRAR` con su versión | Pausada no aparece; retirar con pedidos en curso → 409 `PEDIDOS_EN_CURSO`; retirada conserva el histórico | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js` |
| CP-24 | Catálogo · CU-11 (RF-11) | F | Productos con tildes en nombre/descripción | 1. Buscar sin tildes. 2. Ordenar por precio. 3. Buscar algo inexistente | «cafe», «ocanera», «zzq» | Encuentra sin distinguir tildes; respeta orden y filtros; sin resultados sugiere categorías | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js` |
| CP-25 | Catálogo · CU-12 (RF-12) | F | Productores en Ocaña y Pamplona; permiso de ubicación | 1. Activar «Cerca de mí». 2. Fijar un radio sin productores | GPS de Ocaña; radio 5 km | Orden por distancia con km; el radio filtra y propone ampliarlo | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js` |
| CP-26 | Pedidos · CU-14 (RF-14) | I, TR | Pedido aceptado; otro entregado | 1. Cancelar con motivo. 2. Cancelar a la vez desde ambas partes. 3. Cancelar el entregado | Motivo «Ya no lo necesito» | Inventario restituido una vez; historial con motivo; chat en solo lectura; aviso a la contraparte; el entregado no se cancela | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js` |
| CP-27 | Pedidos · CU-15 (RF-15) | F | Pedidos activos, cancelados y entregados | 1. Filtrar por estado. 2. Filtrar por fechas | `estado=activos|finalizados|todos`, `desde`/`hasta` AAAA-MM-DD | Del más reciente al más antiguo según el filtro, con detalle, historial y acciones | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js` |
| CP-28 | Avisos · CU-16 (RF-16) | TR | Ambas partes conectadas al WebSocket | 1. Aceptar, escribir y cancelar un pedido | — | Cada aviso llega en tiempo real y queda en la bandeja; el de un mensaje abre el chat | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js`, `fase2/notificaciones.test.js` |
| CP-29 | Reportes · CU-19 (RF-19) | F | Publicación de otro usuario | 1. Reportar. 2. Repetir el reporte. 3. Motivo «Otro» sin descripción | Motivo `FRAUDE`; `OTRO` con descripción < 10 caracteres | Reporte «Pendiente»; repetido «en trámite»; «Otro» exige descripción | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js` |
| CP-30 | Administración · CU-18 (RF-18) | SEG | Administrador creado con `npm run crear-admin`; reporte abierto | 1. Revisar el reporte y ocultar. 2. Suspender con pedidos en curso. 3. Entrar al panel sin rol | Motivo de suspensión; `confirmar: true` | Medida aplicada, en bitácora y notificada; la suspensión pide confirmación y cierra la sesión; acceso sin rol → 403 registrado | `e2e/api/fase2.spec.js`, `e2e/ui/fase2.spec.js`, `fase2/reportes_admin.test.js` |
| **CP-31** | Ventas · CU-07 (RF-07) · **ERR-16** | SEG, API | Productor autenticado | 1. `GET /api/v1/ventas?periodo=constructor`. 2. `?periodo=toString`. 3. `?periodo=mes&periodo=anio`. 4. `?periodo=siglo`. 5. `?periodo=mes` (control) | Claves heredadas de `Object.prototype`, parámetro repetido, periodo desconocido | 1–4: 400 `DATOS_INVALIDOS` «Periodo inválido. Use: semana, mes, mes_anterior, anio.»; 5: 200 con el periodo «Este mes» | `api/tests/integration/ventas.test.js` (Jest). E2E: diseñado, no automatizado |
| **CP-32** | Perfil · CU-09 paso 2 (RF-09) · **ERR-17** | F, I | Usuario autenticado con señal; permiso de galería | 1. Abrir «Mi perfil». 2. Tocar «Poner foto de perfil». 3. Elegir una foto. 4. Repetir sin señal | Foto de la galería (se comprime a 1024 px, JPEG 0,6, ≤ 300 KB); archivo no JPEG por API | Se envía a `PUT /perfil/foto` (multipart), se muestra la foto y «✓ Foto de perfil actualizada»; sin señal el botón queda deshabilitado; la sesión guardada recibe la nueva `fotoUrl` sin recargar el formulario (HALL-03); por API un no JPEG → 400 y > 300 KB → 413 `FOTO_MUY_GRANDE` | `app/__tests__/fase2.test.js` (app), `fase2/perfil_privacidad.test.js` (API: JPEG válido, no JPEG, exactamente 300 KB → 200 y 300 KB + 1 byte → 413, HALL-02). E2E: diseñado, no automatizado. En teléfono: verificación manual con Expo Go |

### 7.1 Casos del banco de pruebas (BP)

Los 103 casos BP-001…BP-103 refinan los CP con técnicas de caja negra por módulo; su diseño completo (ID, módulo, requisito, técnica, nivel y caso) está en [BANCO_PRUEBAS.md](BANCO_PRUEBAS.md). Distribución:

| Módulo | Casos | Nivel |
|---|---|---|
| Cuentas, perfil y privacidad | BP-001 … BP-023 (23) | API |
| Inventario y catálogo | BP-024 … BP-046 (23) | API |
| Pedidos, pagos, comunicación, calificación, ventas, avisos, sincronización | BP-047 … BP-075 (29) | API |
| Reportes, administración y no funcionales | BP-076 … BP-088 (13) | API |
| Interfaz | BP-089 … BP-100 (12) | UI |
| Piloto | BP-101 (SUS), BP-102 (push con la app cerrada), BP-103 (Android de gama baja) | Manual |

### 7.2 Pruebas de regresión de la bitácora de errores

| Error | Prueba que lo protege |
|---|---|
| ERR-01a/b (migraciones pendientes, CRLF) | `api/tests/unit/arranque.test.js` |
| ERR-01c/e (URL automática de la API, diagnóstico) | `app/__tests__/servidor.test.js` |
| ERR-01d (CORS en red local) | `api/tests/unit/arranque.test.js` |
| ERR-03 (pantalla en blanco sin señal en web) | CP-04, CP-17 (UI) |
| ERR-06 (tipo de `$7`) | `fase2/cuentas.test.js`, `fase2/perfil_privacidad.test.js` |
| ERR-09, ERR-13 (interbloqueos en segundo plano) | `api/tests/integration/limpiar.js` + 18 suites de integración |
| ERR-11 (escritura atómica del correo) | BP-013 en 3 repeticiones |
| ERR-14 (reloj BD vs. Node) | CP-02 (`auth.test.js`) |
| ERR-15 (timeout de la app) | Suite `sincronizacion.test.js` completa en la primera posición |
| ERR-16 (periodo heredado) | CP-31 |
| ERR-17 (foto de perfil sin interfaz) | CP-32 |

## 8. Trazabilidad requisitos → casos

| Requisito | Casos de sistema | Banco | Suites Jest |
|---|---|---|---|
| RF-01 Registro e inicio de sesión | CP-01, CP-02 | BP-001…BP-011 | `auth.test.js`, `auth.service.test.js`, `auth.validacion.test.js`, `cuenta.test.js` |
| RF-02 Publicar productos | CP-03, CP-04 | BP-024…BP-029 | `productos.test.js` (API y app) |
| RF-03 Catálogo con filtros | CP-05 | BP-030…BP-032 | `productos.test.js` |
| RF-04 Pedidos | CP-06, CP-07, CP-16 | BP-047…BP-051 | `pedidos.test.js` (API y app) |
| RF-05 Chat | CP-09 | BP-064…BP-066 | `comunicacion.test.js`, `tiempoReal.test.js` |
| RF-06 Calificaciones | CP-10 | BP-067, BP-068 | `comunicacion.test.js` |
| RF-07 Panel de ventas | CP-11, **CP-31** | BP-069 | `ventas.test.js` |
| RF-08 Recuperar contraseña | CP-20 | BP-012…BP-015 | `fase2/cuentas.test.js` |
| RF-09 Perfil | CP-21, **CP-32** | BP-016…BP-019, BP-096 | `fase2/perfil_privacidad.test.js`, `fase2.test.js` |
| RF-10 / RF-10a Publicaciones | CP-13, CP-23 | BP-033…BP-038, BP-097 | `fase2/productos.test.js` |
| RF-11 Búsqueda y orden | CP-24 | BP-039…BP-043, BP-094 | `fase2/productos.test.js` |
| RF-12 «Cerca de mí» | CP-25 | BP-044…BP-046 | `fase2/productos.test.js` |
| RF-13 Estados del pedido | CP-08 | BP-052…BP-055 | `pedidos.test.js` |
| RF-14 Cancelar | CP-26 | BP-056…BP-058, BP-095 | `fase2/pedidos.test.js` |
| RF-15 / RF-15a Historial | CP-14, CP-27 | BP-059, BP-060 | `fase2/pedidos.test.js` |
| RF-16 / RF-16a Avisos y push | CP-15, CP-28 | BP-070, BP-071, BP-099, BP-102 | `push.test.js`, `fase2/notificaciones.test.js`, `fcm.test.js` |
| RF-17 Sin conexión | CP-04, CP-17 | BP-072…BP-075, BP-093 | `sync.test.js`, `sincronizacion.test.js` |
| RF-18 Administración | CP-30 | BP-079…BP-083, BP-098 | `fase2/reportes_admin.test.js` |
| RF-19 Reportes | CP-29 | BP-076…BP-078 | `fase2/reportes_admin.test.js` |
| RF-20 Privacidad | CP-22 | BP-020…BP-023 | `fase2/perfil_privacidad.test.js` |
| RF-21 Pago en línea | CP-18, CP-19 | BP-061…BP-063 | `pagos.test.js` |
| RNF-01 Rendimiento | CP-05 | BP-084 | — |
| RNF-02 Usabilidad | CP-12 | BP-100, BP-101 | — |
| RNF-03 Sincronización ≥ 98 % | CP-17 | BP-075 | `sync.test.js` |
| RNF-04 Seguridad | CP-02, CP-19, CP-30, CP-31 | BP-085…BP-087 | `autenticacion.test.js`, `error-handler.test.js` |
| RNF-05 Datos personales | CP-01, CP-22 | BP-002, BP-020 | `fase2/perfil_privacidad.test.js` |
| RNF-06 Android de gama baja | — | BP-103 (manual) | — |
| RNF-07 Disponibilidad | — | BP-088 | `salud.test.js`, `salud.service.test.js` |
| RNF-09 Consumo de datos | CP-03, CP-32 | — | `fotos-s3.test.js`, `productos.test.js` |
| RNF-10 Idempotencia | CP-16 | BP-049 | `pedidos.test.js` |

## 9. Gestión de defectos

- Todo defecto se registra en [REGISTRO_DE_ERRORES.md](REGISTRO_DE_ERRORES.md) con ID `ERR-xx`, fecha, origen, síntoma, causa raíz, severidad (Alta / Media / Baja), solución y verificación (IEEE 1044).
- Severidad Alta o Media bloquea la liberación (criterio de salida). Cada corrección agrega o ajusta una prueba automática (sección 7.2).
- Los hallazgos de usabilidad del piloto se registran con la escala de Nielsen en `docs/piloto/REGISTRO_RESULTADOS.md`; los de severidad 3–4 se corrigen en la EDT 6.2.

## 10. Riesgos de las pruebas

| Riesgo | Efecto | Respuesta |
|---|---|---|
| Carpeta en OneDrive bajo WSL (disco lento, `node_modules` de Windows) | Tiempos de espera y fallos de entorno (ERR-15) | Ejecución secuencial con el Node de Windows; `testTimeout` 30 s |
| Diferencia de relojes BD / Node | Falsos negativos en aserciones de tiempo (ERR-14) | Tolerancias explícitas en las pruebas de tiempo |
| Participación de la asociación en el piloto | CP-12, CP-15 y BP-101…103 sin ejecutar | Fechas acordadas (26/11–01/12); kit del piloto listo; respaldo: prueba con usuarios sustitutos |
| Sin URL pública para Wompi | Checkout real sin probar | Eventos firmados (CP-18, CP-19); prueba de humo en AWS |
| Expo Go no recibe push en Android | CP-15 no se puede probar con Expo Go | APK del perfil `piloto` de EAS con Firebase |
