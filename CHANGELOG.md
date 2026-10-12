# Cambios

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
