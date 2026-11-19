# Registro de errores · AgroTech

Bitácora de defectos e incidencias del proyecto (clasificación basada en IEEE 1044: síntoma, causa raíz, severidad, solución y verificación).
Insumo del análisis de errores del plan de métricas (Entrega 4) y de la gestión de riesgos (RSGR).

| Campo | Valor |
|---|---|
| Versión del sistema | 1.1.1 (corrige los errores ERR-01 a ERR-05) |
| Fecha de corte | 18 de noviembre de 2026 |
| Estado global | ERR-01 (reportado por el usuario) con 6 causas, y 16 errores más: 21 corregidos y verificados · 1 mitigado (ERR-01f, depende del equipo del usuario) |
| Severidad | **Alta**: impide usar la app o una función principal · **Media**: afecta una función o la calidad sin bloquear · **Baja**: cosmético, de entorno de pruebas o de herramientas |

## 1. Resumen

| ID | Fecha | Origen | Error (síntoma) | Severidad | Estado |
|---|---|---|---|---|---|
| ERR-01 | 16-nov | Reportado por el usuario | Al abrir la app siempre sale «No hay conexión con el servidor» y no deja hacer nada | Alta | Corregido (causas ERR-01a … ERR-01f) |
| ERR-01a | 16-nov | Análisis de ERR-01 | Inicio de sesión responde «Ocurrió un error inesperado» (500) | Alta | Corregido |
| ERR-01b | 16-nov | Análisis de ERR-01 | `npm run migrate` se detiene: «La migración 001 cambió después de aplicarse» | Alta | Corregido |
| ERR-01c | 16-nov | Análisis de ERR-01 | La app apunta a una IP vieja del computador (`app/.env`) | Alta | Corregido |
| ERR-01d | 16-nov | Análisis de ERR-01 | La vista web abierta con `127.0.0.1` o la IP de la red queda sin conexión (CORS) | Media | Corregido |
| ERR-01e | 16-nov | Análisis de ERR-01 | El mensaje de error no dice a qué servidor intentó llegar ni qué revisar | Baja | Corregido |
| ERR-01f | 16-nov | Análisis de ERR-01 | El Firewall de Windows puede bloquear el puerto 3000 desde el teléfono | Media | Mitigado (script) |
| ERR-02 | 16-nov | Registro de Expo (usuario) | «Project is incompatible with this version of Expo Go» (Expo Go SDK 58, proyecto SDK 57) | Alta | Corregido (proyecto en SDK 58) |
| ERR-03 | 16-nov | Pruebas CP-04 y CP-17 tras pasar a SDK 58 | Pantalla en blanco al navegar sin señal en la vista web | Alta | Corregido |
| ERR-04 | 16-nov | Pruebas de la app tras pasar a SDK 58 | Las pruebas de navegación de las 7 suites fallan: `render.getPathname is not a function` | Media | Corregido |
| ERR-05 | 16-nov | Lint tras pasar a SDK 58 | `'AndroidImportance' not found in imported namespace 'Notifications'` | Baja | Corregido |
| ERR-06 | 15-nov | Pruebas de integración (Fase 2) | Registro falla con `42P08 inconsistent types deduced for parameter $7` | Alta | Corregido |
| ERR-07 | 15-nov | Pruebas de la app (Fase 2) | El catálogo sin señal dejó de encontrar la copia local (4 pruebas) | Media | Corregido |
| ERR-08 | 15-nov | Pruebas de interfaz (Fase 2) | Filtro muestra «Orden: Orden: …» | Baja | Corregido |
| ERR-09 | 15-nov | Pruebas de integración (Fase 2) | Errores en consola: interbloqueo (40P01) y llave foránea (23503) al guardar avisos | Media | Corregido |
| ERR-10 | 15-nov | Capturas de las pruebas de sistema | Pantalla «Mi cuenta»: los botones se estiran a toda la altura | Media | Corregido |
| ERR-11 | 16-nov | Banco de pruebas (repetición 3×) | Fallo intermitente en BP-013 (299/300): «Unexpected end of JSON input» | Baja | Corregido |
| ERR-12 | 16-nov | Banco de pruebas | La prueba de la semilla de datos excede 5 s con bcrypt de costo 12 | Baja | Corregido |
| ERR-13 | 16-nov | GitHub Actions (CI en `main` tras el PR #1) | Falla intermitente: `deadlock detected` en el `TRUNCATE` previo a una prueba de WebSocket (243/244) | Baja | Corregido |
| ERR-14 | 18-nov | Revisión de código final | CP-02 falla intermitente: `Expected <= 15, Received 15.00005` (243/244) | Baja | Corregido |
| ERR-15 | 18-nov | Revisión de código final | 8 pruebas de `sincronizacion.test.js` fallan en cascada: `Exceeded timeout of 5000 ms` (89/97) | Baja | Corregido |
| ERR-16 | 18-nov | Revisión de código final | `GET /ventas?periodo=constructor` pasa la validación (propiedad heredada de `Object.prototype`) | Baja | Corregido |
| ERR-17 | 18-nov | Revisión de código final | La API ofrece `PUT /perfil/foto` (CU-09 paso 2) pero la app no permite cambiar la foto de perfil | Media | Corregido |

## 2. Detalle del error reportado: ERR-01 «No hay conexión con el servidor»

**Síntoma (usuario):** al iniciar la app siempre sale error de conexión y no deja hacer nada.
**Por qué bloquea todo:** la app considera que «hay señal» solo si `GET /api/v1/salud` responde 200 (RF-17, `useConexion.js`). Si la API no responde, o responde 503 porque no tiene base de datos, la app entra en modo sin señal: no deja iniciar sesión, registrarse ni comprar.

**Evidencia revisada:**
- `app/.expo/dev/logs/start.log`: Expo arrancó con `EXPO_PUBLIC_API_URL=http://192.168.1.28:3000`. Después `app/.env` se cambió a `192.168.1.31`, lo que muestra que la IP del computador cambia.
- El mismo registro muestra el ERR-02 (Expo Go SDK 58).
- Se reprodujo el escenario en el entorno de pruebas con una base de datos migrada hasta la 005 y archivos SQL con saltos de línea de Windows.

### ERR-01a · Base de datos sin la migración 006
| Campo | Detalle |
|---|---|
| Causa raíz | La API 1.1.0 consulta columnas nuevas (`usuario.version_sesion`, tabla `municipio`, …) que crea la migración 006. La base del equipo seguía en la 005 (versión 1.0.0). Consola: `column "version_sesion" does not exist` |
| Efecto | `POST /auth/sesion` → 500 `ERROR_INTERNO`; todas las peticiones con sesión fallan |
| Solución | Al arrancar, la API comprueba la base de datos y aplica solo las migraciones pendientes (`api/src/server.js`, `pendientes()` en `api/src/db/migrate.js`). `AUTO_MIGRAR=false` lo desactiva (producción migra en el despliegue) |
| Verificación | Base en 005 → al arrancar: `[migrate] aplicando 006_fase2_srs.sql`; `/salud` = migración 006; registro e inicio de sesión responden 201/200 |

### ERR-01b · Checksum de migraciones sensible a CRLF
| Campo | Detalle |
|---|---|
| Causa raíz | El ejecutor de migraciones compara el SHA-256 del archivo con el guardado al aplicarlo. Con Git en Windows (`core.autocrlf`) los .sql tienen CRLF; el mismo archivo con LF da otro checksum y el migrador lo toma como «editado» |
| Efecto | `npm run migrate` se detiene en la 001 y nunca aplica la 006 (ERR-01a no se podía resolver a mano) |
| Solución | El checksum se calcula con LF y se aceptan como equivalentes las versiones CRLF/LF del mismo contenido (`listMigrations`) |
| Verificación | Migrador anterior: «La migración 001_esquema_inicial.sql cambió…»; migrador corregido: aplica la 006. Prueba unitaria `tests/unit/arranque.test.js` |

### ERR-01c · IP de la API escrita a mano
| Campo | Detalle |
|---|---|
| Causa raíz | `EXPO_PUBLIC_API_URL=http://192.168.1.x:3000` en `app/.env`. El router reasigna la IP del computador (.28 → .31) y la app sigue llamando a la anterior. Además Expo guarda el valor en el paquete: un cambio exige reiniciar con `--clear` |
| Solución | `EXPO_PUBLIC_API_URL=auto`: la app usa el mismo computador que le sirve el código (host de Metro en Expo Go, host de la página en web), puerto 3000 (`app/src/api/servidor.js`). Una URL completa se sigue respetando (los builds de EAS fijan `https://api.agrotech.co`) |
| Verificación | Pruebas `__tests__/servidor.test.js`; vista web compilada con `auto` y abierta en `127.0.0.1` → peticiones a `http://127.0.0.1:3000/api/v1/…` e inicio de sesión correcto |

### ERR-01d · CORS solo para `http://localhost:8081`
| Campo | Detalle |
|---|---|
| Causa raíz | En desarrollo la API solo aceptaba el origen `http://localhost:8081`. Abrir la vista web como `127.0.0.1` o con la IP de la red hacía que el navegador bloqueara las respuestas |
| Solución | En `NODE_ENV=development` se aceptan los orígenes de localhost y de redes privadas (10.x, 172.16–31.x, 192.168.x) en cualquier puerto. En producción sigue la lista explícita (`api/src/middleware/cors.js`) |
| Verificación | `OPTIONS` con `Origin: http://192.168.1.31:8081` → 204 con `Access-Control-Allow-Origin`; orígenes externos rechazados (prueba unitaria) |

### ERR-01e · Diagnóstico insuficiente
| Campo | Detalle |
|---|---|
| Causa raíz | La bienvenida decía solo «Servidor: sin conexión (SIN_CONEXION)», sin la dirección ni la causa probable; la API no mostraba la IP que debe usar el teléfono ni avisaba si PostgreSQL estaba apagado |
| Solución | La bienvenida (solo desarrollo) muestra la URL que intenta, distingue «API apagada/red» de «API sin base de datos (503)» y se vuelve a comprobar cada 5 s. La API imprime las IP de la red local al arrancar y, si PostgreSQL no responde, lo dice y reintenta cada 10 s |
| Verificación | Pruebas `diagnosticoServidor`; arranque con PostgreSQL apagado: `[db] NO se pudo conectar a PostgreSQL en localhost:5434/agrotech … Reintento en 10 s` y `/salud` → 503 |

### ERR-01f · Firewall de Windows
| Campo | Detalle |
|---|---|
| Causa raíz | Si la red Wi-Fi está marcada como pública o se rechazó el aviso del Firewall, Windows bloquea las conexiones entrantes al puerto 3000 desde el teléfono |
| Solución | `herramientas/windows/permitir-firewall.cmd` (como administrador, una vez) abre los puertos 3000 y 8081 solo para la red local; `iniciar-agrotech.cmd` arranca la API y la app |
| Estado | Mitigado: depende de la configuración del equipo; no se puede verificar desde el entorno de pruebas |

## 3. Errores de la actualización a Expo SDK 58

| ID | Causa raíz | Solución | Verificación |
|---|---|---|---|
| ERR-02 | Expo Go de la tienda solo abre proyectos del SDK más reciente (58); el proyecto estaba en 57 | Proyecto actualizado a SDK 58 (React Native 0.88, React 19.3) y revisado | 97/97 pruebas de la app, lint limpio, compilación web correcta |
| ERR-03 | SDK 58 activa por defecto las rutas asíncronas en web: cada pantalla se descarga al abrirla, y sin señal la descarga falla (pantalla en blanco). Rompe el modo sin conexión (RF-17) | `["expo-router", { "asyncRoutes": false }]` en `app/app.json`: un solo paquete | CP-04 y CP-17 pasan; 51/51 pruebas de sistema |
| ERR-04 | En SDK 58 `renderRouter` de `expo-router/testing-library` devuelve una promesa | `await renderRouter(...)` en las 7 suites | 97/97 |
| ERR-05 | El plugin `import/namespace` no reconoce el `export *` de `expo-notifications` 58 (en ejecución sí existe) | Excepción documentada en `push.js` | `expo lint` sin errores |

## 4. Errores de la Fase 2, del banco de pruebas y de la integración continua

| ID | Causa raíz | Solución | Verificación |
|---|---|---|---|
| ERR-06 | El parámetro `$7` se usaba como texto y en una expresión: PostgreSQL no podía deducir el tipo | Conversión explícita `$7::varchar` (registro, perfil, crear-admin) | Pruebas de integración de cuentas y perfil |
| ERR-07 | El nuevo parámetro `orden=recientes` cambiaba la URL del catálogo y la caché del MVP no la encontraba | El orden por defecto no se envía en la URL | 4 pruebas de la app vuelven a pasar |
| ERR-08 | El componente `Filtro` anteponía la etiqueta y el texto ya la traía | Propiedad `etiqueta` separada del valor | Prueba de interfaz del catálogo |
| ERR-09 | Los avisos se guardan en segundo plano y chocaban con borrados simultáneos | `encolar` reintenta ante 40P01 e ignora 23503 (usuario ya borrado) | 232 pruebas sin errores en consola |
| ERR-10 | Los mosaicos de «Mi cuenta» usaban `flex: 1` en una columna | Rejilla de 2 columnas | Capturas y pruebas de interfaz de la Fase 2 |
| ERR-11 | El driver de correo «archivo» escribía el JSON directamente en el archivo final | Escritura atómica (temporal + renombrar) y lector tolerante | Banco repetido 3 veces: 300/300 |
| ERR-12 | La prueba de la semilla hace dos siembras completas con bcrypt de costo 12 | Límite de 20 s | 244/244 |
| ERR-13 | Tareas en segundo plano de la prueba anterior (avisos, cierre de WebSocket) seguían escribiendo cuando la siguiente vaciaba las tablas; PostgreSQL abortó el `TRUNCATE` por interbloqueo. En el PR pasó y en `main` falló: intermitente | `vaciarUsuarios()` (tests/integration/limpiar.js) reintenta el `TRUNCATE` ante 40P01; usado por las 17 suites de integración | 244/244 dos veces seguidas en local; CI en verde |

## 4b. Errores de la revisión de código final (18-nov)

| ID | Causa raíz | Solución | Verificación |
|---|---|---|---|
| ERR-14 | `bloqueado_hasta` lo calcula PostgreSQL (`now()`) y la prueba lo compara con `Date.now()` de Node: un desfase de milisegundos entre el reloj del contenedor y el del equipo supera el límite exacto de 15 min | Tolerancia de 5 s en `api/tests/integration/auth.test.js` (las pruebas e2e ya usaban 15,1 min) | 244/244 |
| ERR-15 | La primera suite que corre paga la compilación en frío de Babel sobre la carpeta de OneDrive; el primer test supera 5 s y deja el router a medio montar, lo que hace fallar los 7 siguientes | `testTimeout: 30000` en la configuración de Jest de `app/package.json` | 98/98 |
| ERR-16 | `PERIODOS[codigo]` acepta claves heredadas (`constructor`, `toString`) | `Object.hasOwn` y tipo `string` en `api/src/modules/ventas/ventas.service.js` | Prueba «400 con … periodo desconocido» ampliada |
| ERR-17 | Inconsistencia backend ↔ app: el endpoint existía y estaba probado, pero no había llamada ni control en la app | `api.cambiarFotoPerfil` (`app/src/api/cliente.js`) y sección de foto en `PantallaPerfil.js` (comprime con `obtenerFoto`; requiere señal) | Nueva prueba en `app/__tests__/fase2.test.js` |

## 5. Verificación de la versión 1.1.1

| Nivel | Resultado |
|---|---|
| API (Jest: unitarias + integración) | 244/244 |
| App (Jest + Testing Library, SDK 58) | 98/98 (97 al 16/11 + la prueba de CP-32, ERR-17, del 18/11) |
| Pruebas de sistema CP-01 … CP-30 (Playwright) | 51/51 pruebas · 28 PASA · 2 manuales |
| Banco de pruebas BP-001 … BP-103 | 100/100 · 3 manuales |
| Lint API y app | Sin errores |

## 6. Lecciones (para el RSGR)

- Una versión nueva de la API debe poder arrancar sobre la base de la versión anterior: las migraciones pendientes se aplican solas o el arranque lo dice claramente.
- Las configuraciones que dependen de la red del equipo (IP) deben detectarse solas en desarrollo.
- Expo Go obliga a seguir el SDK más reciente: cada actualización se valida con la suite completa (unitarias, sistema y banco), porque cambia comportamientos por defecto (ERR-03).
- Los errores de conexión deben decir a qué dirección se intentó llegar y qué revisar.
