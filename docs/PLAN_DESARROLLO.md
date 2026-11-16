# Plan de desarrollo por fases

Cada fase termina con pruebas en verde, fusión a `develop` y aprobación del Project Manager antes de iniciar la siguiente.

| Fase | Alcance | Tarjetas Jira | RF | Estado |
|---|---|---|---|---|
| 1. Plataforma | Repositorio, convenciones, BD + migraciones, API base, app base con navegación por rol, CI | AGRO-1, 2, 3, 4 | — | Terminada |
| 2. Cuentas | Registro con autorización de datos, inicio de sesión, JWT, bloqueo tras 5 intentos, sesión segura en la app | AGRO-5 | RF-01 | Terminada |
| 3. Inventario y catálogo | Publicar producto con foto, corregir precio/cantidad, catálogo con filtros | AGRO-6, 7, 18 | RF-02, RF-03, RF-10a | Terminada |
| 4. Pedidos y pago | Carrito, confirmar pedido idempotente, estados del pedido, pedidos activos del consumidor, pago en línea opcional con Wompi ([ADR-001](decisiones/ADR-001-pasarela-de-pago.md)) | AGRO-8, 9, 19, 21 | RF-04, RF-13, RF-15a, RF-21 | Terminada |
| 5. Sin conexión | Caché local, cola de operaciones y sincronización asíncrona | AGRO-10 | RF-17 | Terminada |
| 6. Comunicación y ventas | Chat por pedido, calificaciones, panel de ventas, push de pedido nuevo | AGRO-11, 12, 13, 20 | RF-05, RF-06, RF-07, RF-16a | Terminada |
| 8. Fase 2 del SRS (v1.1.0) | Recuperar contraseña, perfil, privacidad (Ley 1581), pausar/retirar, búsqueda y cercanía, cancelar, historial, avisos completos, reportes y panel de administración | AGRO-22 … 29 | RF-08, RF-09, RF-10, RF-11, RF-12, RF-14, RF-15, RF-16, RF-18, RF-19, RF-20 | Terminada · API 232, App 87, Sistema 51 pruebas en verde |
| 7. Despliegue y pruebas | Pruebas de sistema automatizadas, AWS (EC2, RDS, S3), APK con EAS, kit del piloto y de la validación UCD | AGRO-14, 15, 16, 17 | RNF-01…RNF-10 | Terminada (ejecución en campo programada) |

## Fase 7 · estado por tarjeta

| Tarjeta | Entregable | Estado | Evidencia |
|---|---|---|---|
| AGRO-14 | Suite E2E de caja negra CP-01…CP-19 (Playwright: API REST, WebSocket y app web con 3G simulado) + matriz de trazabilidad automática | Terminada · 29/29 pruebas, 17 casos PASA, 2 manuales | `e2e/`, `docs/pruebas/INFORME_PRUEBAS_SISTEMA.md` |
| AGRO-16 | Plantilla CloudFormation, systemd, despliegue continuo con OIDC, driver S3, perfiles EAS (APK/AAB) | Terminada · validada con cfn-lint, shellcheck y actionlint; creación real de la pila sujeta a la cuenta de AWS | `infra/`, `docs/despliegue/RUNBOOK.md`, ADR-002 |
| AGRO-17 | Protocolo de validación de los 5 wireframes con productores | Lista para ejecutar el 13/10 (requiere a la asociación) | `docs/piloto/VALIDACION_PROTOTIPOS_UCD.md` |
| AGRO-15 | Protocolo, guion, SUS, consentimiento, registro, `npm run piloto:informe`, `npm run sembrar` | Lista para ejecutar del 26/11 al 01/12 (requiere a la asociación) | `docs/piloto/` |

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
