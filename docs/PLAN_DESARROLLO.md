# Plan de desarrollo por fases

Cada fase termina con pruebas en verde, fusión a `develop` y aprobación del Project Manager antes de iniciar la siguiente.

| Fase | Alcance | Tarjetas Jira | RF | Estado |
|---|---|---|---|---|
| 1. Plataforma | Repositorio, convenciones, BD + migraciones, API base, app base con navegación por rol, CI | AGRO-1, 2, 3, 4 | — | Terminada |
| 2. Cuentas | Registro con autorización de datos, inicio de sesión, JWT, bloqueo tras 5 intentos, sesión segura en la app | AGRO-5 | RF-01 | Terminada |
| 3. Inventario y catálogo | Publicar producto con foto, corregir precio/cantidad, catálogo con filtros | AGRO-6, 7, 18 | RF-02, RF-03, RF-10a | Pendiente |
| 4. Pedidos y pago | Carrito, confirmar pedido idempotente, estados del pedido, pedidos activos del consumidor, pago en línea opcional con Wompi ([ADR-001](decisiones/ADR-001-pasarela-de-pago.md)) | AGRO-8, 9, 19, 21 | RF-04, RF-13, RF-15a, RF-21 | Pendiente |
| 5. Sin conexión | Caché local, cola de operaciones y sincronización asíncrona | AGRO-10 | RF-17 | Pendiente |
| 6. Comunicación y ventas | Chat por pedido, calificaciones, panel de ventas, push de pedido nuevo | AGRO-11, 12, 13, 20 | RF-05, RF-06, RF-07, RF-16a | Pendiente |
| 7. Despliegue y pruebas | AWS (EC2, RDS, S3), APK, plan de pruebas y piloto con la asociación | AGRO-14, 15, 16, 17 | RNF | Pendiente |

## Hitos

| Hito | Fecha |
|---|---|
| E5 — MVP | 13/11/2026 |
| E6 — Cierre | 03/12/2026 |

## Criterio de salida de una fase

- Pruebas unitarias e integración de la fase en verde en CI.
- Criterios de aceptación (CA) de los RF de la fase verificados.
- Documentación actualizada (README, CONTRIBUTING o especificación de la API).
- Tarjetas Jira en la columna *Hecho*.
