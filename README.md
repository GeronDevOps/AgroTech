# AgroTech

App móvil para la comercialización directa de productos agrícolas en Norte de Santander.
Proyecto de Ingeniería de Software II · Universidad de Pamplona.

## Estructura del repositorio

| Carpeta | Contenido | Responsable |
|---|---|---|
| `/app` | App móvil React Native (Expo) | J. Durán |
| `/api` | API REST y servidor WebSocket en Node.js | G. Vergara |
| `/db/migrations` | Migraciones SQL versionadas de PostgreSQL + PostGIS | G. Vergara |
| `/docs` | Convenciones del equipo y decisiones técnicas | J. Carrillo |
| `/.github` | Integración continua y plantilla de Pull Request | G. Vergara |

## Arquitectura (Tier-3)

- **Nivel 1 · Presentación:** `/app`.
- **Nivel 2 · Lógica:** `/api` organizada en capas: rutas → controladores → servicios → repositorios.
- **Nivel 3 · Datos:** PostgreSQL 17 + PostGIS 3.5 (`/db/migrations`) y Amazon S3 para las fotos.

Detalle en la Entrega 3 (Diseño del sistema).

## Requisitos para desarrollar

- Node.js 22 o superior y npm.
- PostgreSQL con la extensión PostGIS (local o en contenedor).
- Para la app: la app Expo Go en un teléfono Android, o un emulador de Android Studio.

## Puesta en marcha

### Base de datos

```bash
createdb agrotech
createdb agrotech_test
```

### API

```bash
cd api
cp .env.example .env          # ajustar DATABASE_URL
npm install
npm run migrate               # aplica /db/migrations
npm run dev                   # http://localhost:3000/api/v1/salud
npm test                      # pruebas unitarias y de integración
```

### App

```bash
cd app
cp .env.example .env          # EXPO_PUBLIC_API_URL con la IP del computador
npm install
npm start                     # escanear el QR con Expo Go
npm test
```

## Flujo de trabajo

Resumen de [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md):

1. Tomar una tarjeta en Jira (máximo 2 en progreso por persona).
2. Rama `feature/AGRO-<n>-descripcion` desde `develop`.
3. Commits con el formato `AGRO-<n>: descripción breve`.
4. Pull Request hacia `develop` con la integración continua en verde y la revisión de otro integrante.

## Integración continua (AGRO-4)

`.github/workflows/ci.yml` se ejecuta en cada push y PR hacia `develop` y `main`.

| Trabajo | Pasos | Entorno |
|---|---|---|
| `api` | `npm ci` → lint → `npm run migrate` → `npm test` | Node 22 + servicio `postgis/postgis:17-3.5` |
| `app` | `npm ci` → lint → `npm test` → `expo export --platform android` | Node 22 |

Plan de fases: [docs/PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md).
