# Cambios

## [1.1.1] · 2026-11-16 · Corrección de «No hay conexión con el servidor»

**Causas encontradas y corregidas**
- La API 1.1.0 sobre una base de datos de la versión 1.0.0 (sin la migración 006) fallaba al iniciar sesión (`column "version_sesion" does not exist`). Ahora la API aplica las migraciones pendientes al arrancar (`AUTO_MIGRAR=false` lo desactiva) y, si PostgreSQL está apagado, lo dice en la consola y reintenta cada 10 s.
- `npm run migrate` se detenía con «La migración 001 cambió después de aplicarse» cuando los .sql tenían saltos de línea de Windows (CRLF). El checksum ahora es independiente de CRLF/LF.
- La IP de la API estaba escrita a mano en `app/.env` y cambia con el router. Con `EXPO_PUBLIC_API_URL=auto` la app usa el mismo computador que la sirve (Expo Go o la vista web).
- La vista web abierta con `127.0.0.1` o con la IP de la red local era bloqueada por CORS. En desarrollo se aceptan los orígenes de la red local.
- Expo SDK 58 (requerido por Expo Go actual): rutas asíncronas desactivadas en web (con ellas las pantallas no cargaban sin señal), pruebas adaptadas a `renderRouter` asíncrono y aviso de lint de `expo-notifications`.
- La bienvenida (desarrollo) muestra la dirección que intenta la app y qué revisar; la API imprime las IP de la red local al arrancar. Scripts `herramientas/windows/iniciar-agrotech.cmd` y `permitir-firewall.cmd`.

**Verificación:** API 244/244 · app 97/97 · CP-01…CP-30 51/51 · banco 100/100.

## v1.1.0 · Fase 2 del SRS (Fase 8)

| Módulo | RF | Contenido | Tarjetas |
|---|---|---|---|
| Recuperar contraseña | RF-08 | Código de 6 dígitos por correo (15 min, 3 intentos, un solo uso); cierra las demás sesiones (versión de sesión en el JWT) | AGRO-22 |
| Perfil y privacidad | RF-09, RF-20 | Mi perfil con coordenadas recalculadas y foto; Privacidad y datos (consulta, supresión con anonimización, aplazamiento y desistimiento; nuevo aviso de privacidad) | AGRO-23 |
| Publicaciones | RF-10 | Pausar, reactivar y retirar (bloqueado con pedidos en curso); editar nombre y descripción | AGRO-24 |
| Catálogo | RF-11, RF-12 | Búsqueda sin tildes, orden por precio/fecha/calificación, «Cerca de mí» con GPS o municipio (PostGIS) y radio | AGRO-25 |
| Pedidos | RF-14, RF-15 | Cancelar con motivo por cualquiera de las partes; historial con filtros de estado y fechas; acciones disponibles | AGRO-26 |
| Avisos | RF-16 | Push y bandeja interna para estados, cancelaciones, mensajes y moderación | AGRO-27 |
| Reportes | RF-19 | Reportar publicaciones, comentarios y pedidos; sin señal se encolan | AGRO-28 |
| Administración | RF-18 | Panel web: reportes, ocultar, suspender con confirmación, verificar productores, supresiones y bitácora; `npm run crear-admin` | AGRO-29 |

**Base de datos:** migración `006_fase2_srs.sql` (municipios con coordenadas, recuperación de contraseña, solicitudes de supresión, reportes con decisión, bandeja de avisos, índice de búsqueda).

**Pruebas en la versión:** API 232 (177 + 55) · App 87 (76 + 11) · Sistema 51 (29 + 22): 28 casos PASA, 2 manuales (CP-12, CP-15). Cobertura de la API: 95,7 % de líneas.

**Correcciones encontradas por las pruebas:** avisos en segundo plano que chocaban con borrados (reintento ante interbloqueo); el orden por defecto ya no se envía en la URL del catálogo (compatibilidad con la caché del MVP).

**Banco de pruebas del sistema:** 103 casos BP-001 … BP-103 diseñados con técnicas de caja negra (partición de equivalencia, valores límite, tabla de decisión, transición de estados, flujo de CU, conjetura de errores, seguridad, rendimiento y concurrencia) sobre los 21 RF y 7 RNF. 100 automatizados (88 API + 12 interfaz) en PASA, estables en 3 repeticiones (300/300); 3 manuales para el piloto. Ejecución: `cd e2e && npm run banco`. Corrección encontrada: escritura atómica del driver de correo «archivo» (DEF-B01).


## v1.0.0 · MVP (Fase 7)

| Módulo | RF / RNF | Contenido | Tarjetas |
|---|---|---|---|
| Plataforma | — | Monorepo `app` / `api` / `db` / `e2e` / `infra`, migraciones 001–005, CI | AGRO-1…4 |
| Cuentas | RF-01, RNF-04 | Registro con autorización de datos (Ley 1581), JWT, bloqueo tras 5 intentos | AGRO-5 |
| Inventario y catálogo | RF-02, RF-03, RF-10a | Publicar con foto y miniatura, editar precio y cantidad, catálogo con filtros y paginación | AGRO-6, 7, 18 |
| Pedidos y pago | RF-04, RF-13, RF-15a, RF-21 | Carrito, pedido idempotente por productor, estados con historial, pago en línea opcional (Wompi) | AGRO-8, 9, 19, 21 |
| Sin conexión | RF-17, RNF-03 | SQLite local, cola de operaciones, `/sync/push` y `/sync/pull` con conflictos | AGRO-10 |
| Comunicación y ventas | RF-05, RF-06, RF-07, RF-16a | Chat por pedido, calificaciones, panel de ventas, WebSocket y push (FCM) | AGRO-11, 12, 13, 20 |
| Pruebas de sistema | RNF-01…RNF-10 | Suite E2E CP-01…CP-19 (Playwright) con matriz de trazabilidad | AGRO-14 |
| Producción | RNF-04, RNF-07, RNF-09 | AWS con CloudFormation (ALB, EC2, RDS, S3), driver S3, despliegue con OIDC, APK/AAB con EAS | AGRO-16 |
| Piloto | RNF-02 | Kit de validación UCD y del piloto, `npm run sembrar`, `npm run piloto:informe` | AGRO-15, 17 |

**Pruebas en la versión:** API 177 (unitarias + integración) · App 76 · Sistema 29 (17 casos PASA, 2 manuales: CP-12 piloto y CP-15 push en teléfono).

**Corrección encontrada por la suite E2E:** la barra de filtros del catálogo quedaba aplastada en la vista web con listas largas.
