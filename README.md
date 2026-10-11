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
cp .env.example .env          # ajustar DATABASE_URL y generar JWT_SECRETO (ver el comentario del archivo)
npm install
npm run migrate               # aplica /db/migrations
npm run dev                   # http://localhost:3000/api/v1/salud
npm test                      # pruebas unitarias y de integración
```

Pago en línea (RF-21, [ADR-001](docs/decisiones/ADR-001-pasarela-de-pago.md)): sin estas variables la API responde `503 PASARELA_NO_CONFIGURADA` y la app ofrece solo contra entrega.

| Variable | Origen |
|---|---|
| `WOMPI_LLAVE_PUBLICA` | Panel de comercios de Wompi → Desarrolladores → llave pública de pruebas (`pub_test_…`) |
| `WOMPI_SECRETO_INTEGRIDAD` | Mismo panel → secreto de integridad (firma del checkout) |
| `WOMPI_SECRETO_EVENTOS` | Mismo panel → secreto de eventos (firma del webhook) |
| `WOMPI_AMBIENTE` | `test` (sandbox) o `prod` |
| `WOMPI_URL_RETORNO` | `https://<api>/api/v1/pagos/retorno` |
| URL de eventos (en el panel) | `https://<api>/api/v1/pagos/wompi/eventos` |

Las llaves nunca se suben al repositorio (`.env` está en `.gitignore`).

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

Plan de fases: [docs/PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md) · Contrato de la API: [docs/API.md](docs/API.md) · Decisiones: [docs/decisiones/](docs/decisiones/).
