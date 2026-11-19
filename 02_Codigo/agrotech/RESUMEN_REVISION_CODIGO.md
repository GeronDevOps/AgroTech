# Resumen de la revisión de código · AgroTech 1.1.1

| Campo | Valor |
|---|---|
| Fecha | 18 de noviembre de 2026 |
| Rama / punto de partida | `main` · `2f1eb0d` (árbol limpio) |
| Alcance | `api/`, `app/`, `db/`, `e2e/`, `herramientas/`, `docs/` |
| Ejecución | Estrictamente secuencial, en primer plano, sin `--watch` (carpeta en `/mnt/c` bajo WSL) |
| Resultado final | API **244/244** · App **98/98** · Lint de API y app sin errores |

## 1. Estructura revisada

| Carpeta | Qué se revisó | Estado |
|---|---|---|
| `api/` (Node 22 + Express 5 + PostgreSQL/PostGIS) | `src/server.js`, `app.js`, `routes.js` (17 montajes bajo `/api/v1`: `mensajes` y `calificaciones` se montan también anidados en `/pedidos/:id/…`); 16 módulos en `src/modules/<módulo>/` (15 con rutas HTTP + `correo`, transversal) con el patrón `routes → service → repository (+ validacion)`; middleware (autenticación, CORS, errores); `config/env.js`; almacenamiento local/S3; WebSocket; scripts | Organización consistente. Errores de PostgreSQL traducidos a HTTP en `error-handler.js` (UUID mal formado → 400, llaves duplicadas → 409) |
| `app/` (Expo SDK 58, expo-router) | Rutas en `src/app/` por rol (`(auth)`, `consumidor`, `productor`, `administrador`); cliente HTTP `src/api/`; base local SQLite, cola y motor de sincronización; contextos de sesión, carrito y tiempo real | Organización consistente |
| `db/migrations/` | 001 … 006, versionadas y con checksum independiente de CRLF/LF | Correcto |
| `e2e/` | Playwright: pruebas de sistema (CP) y banco (BP) | No se ejecutó (requiere API + vista web levantadas); se revisaron sus aserciones de reloj |
| `herramientas/windows/` | `iniciar-agrotech.cmd`, `permitir-firewall.cmd` | Correcto |
| `docs/` | `pruebas/REGISTRO_DE_ERRORES.md`, CHANGELOG, API | Bitácora actualizada con ERR-14 … ERR-17 |

### Variables de entorno
- `api/.env.example` cubría casi todo lo que lee `config/env.js`, pero **faltaban** `AUTO_MIGRAR` (lo lee `server.js`), `WOMPI_URL_CHECKOUT` y `ADMIN_CONTRASENA` (script `crear-admin`). Se documentaron. También se aclaró que en desarrollo CORS acepta además localhost y las IP de la red local.
- `app/.env.example` (`EXPO_PUBLIC_API_URL=auto`) coincide con `src/api/servidor.js` y con `eas.json` (los builds fijan `https://api.agrotech.co`).
- `.gitignore` excluye `.env`, credenciales de Firebase/FCM, `google-services.json` y `uploads/`.

### Compatibilidad con Expo Go
- SDK 58 en todas las dependencias `expo-*`. Los módulos nativos usados (sqlite, secure-store, location, image-picker, image-manipulator, file-system, notifications) vienen incluidos en Expo Go.
- `asyncRoutes: false` (ERR-03) se mantiene.
- Push: Expo Go en Android no entrega push remoto; `registrarPush()` lo captura y la app sigue con WebSocket y bandeja interna. Correcto.
- La URL de la API y del WebSocket (`ws://<host Metro>:3000/ws`) se resuelven solas a partir del host de Metro.

### Validaciones de entrada
Se revisaron paginación, filtros y lookups en mapas con claves que manda el usuario. Paginación y UUID están bien acotados (valores fuera de rango → 400). El único defecto fue `ventas` (ERR-16).

## 2. Errores y mejoras encontrados

| ID | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| ERR-14 | Baja | **Prueba intermitente CP-02** (`auth.test.js`): `Expected <= 15, Received 15.00005`. `bloqueado_hasta` lo calcula PostgreSQL con `now()` y se compara con `Date.now()` de Node; un desfase de ms entre relojes rompe el límite exacto. La lógica de negocio es correcta | Tolerancia de 5 s, igual que en las pruebas e2e (15,1 min) |
| ERR-15 | Baja | **8 fallos en cascada en `sincronizacion.test.js`** (89/97). El primer test supera el límite de 5 s de Jest por la compilación en frío sobre OneDrive y deja el router a medio montar; los 7 siguientes heredan ese estado | `testTimeout: 30000` en la configuración de Jest de la app |
| ERR-16 | Baja | **Validación de periodo débil**: `GET /ventas?periodo=constructor` (o `toString`) pasaba porque `PERIODOS[codigo]` encuentra propiedades de `Object.prototype` | `Object.hasOwn` + comprobación de tipo `string` (también rechaza `?periodo=a&periodo=b`) |
| ERR-17 | Media | **Inconsistencia backend ↔ frontend**: la API expone y prueba `PUT /perfil/foto` (CU-09 paso 2, anunciado en el CHANGELOG 1.1.0), pero la app no tenía ni la llamada ni el control | `api.cambiarFotoPerfil()` y sección de foto en «Mi perfil»: elige de la galería, comprime con `obtenerFoto` (≤ 300 KB), muestra la foto y se deshabilita sin señal |
| — | Limpieza | **Código muerto**: `app/src/componentes/EnConstruccion.js` (marcador de pantallas planificadas) ya no lo importaba nada | Eliminado |
| — | Limpieza | `api/src/server.js` tenía dos `require` a mitad del archivo | Movidos al encabezado |
| — | Entorno | `node_modules` de `api/` y `app/` se instaló desde Windows: Jest 30 solo trae el binario nativo `resolver-binding-win32-x64-msvc` y **no corre con el Node de WSL** («setupFiles … was not found»). PostgreSQL (puerto 5434) solo es accesible desde Windows | No se modificó `node_modules`; las pruebas se ejecutaron con el Node de Windows (v24) desde WSL (`cmd.exe /c`). Para correrlas desde Linux habría que reinstalar las dependencias con `npm ci` dentro de WSL |

No se encontraron rutas rotas: todas las llamadas de `app/src/api/cliente.js` corresponden a un endpoint montado en `api/src/routes.js` (método y ruta).

## 3. Archivos modificados

| Archivo | Cambio |
|---|---|
| `api/src/modules/ventas/ventas.service.js` | ERR-16: `Object.hasOwn` al validar el periodo |
| `api/src/server.js` | `require` agrupados al inicio |
| `api/.env.example` | Documentadas `AUTO_MIGRAR`, `WOMPI_URL_CHECKOUT`, `ADMIN_CONTRASENA` y el comportamiento de CORS en desarrollo |
| `api/tests/integration/auth.test.js` | ERR-14: tolerancia de reloj en CP-02 |
| `api/tests/integration/ventas.test.js` | ERR-16: casos `constructor`, `toString` y periodo repetido → 400 |
| `app/package.json` | ERR-15: `"testTimeout": 30000` |
| `app/src/api/cliente.js` | ERR-17: `cambiarFotoPerfil(uri)` → `PUT /perfil/foto` (multipart) |
| `app/src/componentes/PantallaPerfil.js` | ERR-17: foto de perfil (ver, poner/cambiar, errores, sin señal) |
| `app/__tests__/fase2.test.js` | ERR-17: prueba de la foto de perfil |
| `app/src/componentes/EnConstruccion.js` | Eliminado (código muerto) |
| `docs/pruebas/REGISTRO_DE_ERRORES.md` | ERR-14 … ERR-17 y nueva fecha de corte |
| `RESUMEN_REVISION_CODIGO.md` | Este documento |

## 4. Resultado de las pruebas

Todas ejecutadas una a una, en primer plano, con `CI=true` y `--watchAll=false` (API además con `--runInBand`), sobre PostgreSQL 17 + PostGIS en `localhost:5434`.

| Ejecución | Antes de los ajustes | Después |
|---|---|---|
| API · Jest (unitarias + integración, 29 suites) | 243/244 (falla CP-02, ERR-14) | **244/244** · 29/29 suites · 314 s |
| App · Jest + Testing Library (9 suites) | 89/97 (8 fallan en `sincronizacion`, ERR-15) | **98/98** · 9/9 suites · 63 s |
| Lint API (`eslint .`) | Sin errores | Sin errores |
| Lint app (`expo lint`) | Sin errores | Sin errores |
| Sistema y banco (Playwright, `e2e/`) | No ejecutadas en esta revisión | — |

**Pendiente recomendado:** volver a correr `cd e2e && npm test` y `npm run banco` con la API y la vista web levantadas antes de la entrega, y probar la nueva foto de perfil en el teléfono con Expo Go.
