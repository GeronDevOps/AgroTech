# 02 · Código

| Carpeta | Contenido |
|---|---|
| [`agrotech`](agrotech) | Monorepo del sistema (versión 1.1.1) con el historial de commits del desarrollo |
| [`Versiones_anteriores`](Versiones_anteriores) | Repositorio comprimido al cierre de cada fase (1 a 7) |

## Monorepo `agrotech`

| Carpeta | Capa (Tier-3) | Tecnología |
|---|---|---|
| [`agrotech/app`](agrotech/app) | Presentación | React Native · Expo SDK 58 · expo-router · SQLite local (modo sin conexión) |
| [`agrotech/api`](agrotech/api) | Lógica de negocio | Node.js 22 · Express 5 · JWT · WebSocket · rutas → controlador → servicio → repositorio |
| [`agrotech/db`](agrotech/db) | Datos | PostgreSQL 16/17 + PostGIS · migraciones versionadas 001 a 006 |
| [`agrotech/e2e`](agrotech/e2e) | Pruebas de sistema | Playwright: casos CP-01 a CP-30 y banco BP-001 a BP-103 |
| [`agrotech/infra`](agrotech/infra) | Despliegue | AWS CloudFormation (ALB, EC2, RDS, S3) y scripts del servidor |
| [`agrotech/docs`](agrotech/docs) | Documentación técnica | API, decisiones, despliegue, piloto y pruebas (incluye el registro de errores) |
| [`agrotech/herramientas/windows`](agrotech/herramientas/windows) | Desarrollo | Arranque de API + app y apertura de puertos en el Firewall |

Flujo de trabajo: Git Flow con ramas `feature/AGRO-*` → `develop` → `release/*` → `main` (Kanban en Jira).
Integración continua: [`.github/workflows`](../.github/workflows) en la raíz del repositorio.
Puesta en marcha y solución de problemas: [agrotech/README.md](agrotech/README.md).
