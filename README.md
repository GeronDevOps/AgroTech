# AgroTech

App móvil para la comercialización directa de productos agrícolas en Norte de Santander.
Proyecto de Ingeniería de Software II · Universidad de Pamplona.

## Estructura del repositorio

| Carpeta | Contenido | Responsable |
|---|---|---|
| `/app` | App móvil React Native (Expo) | J. Durán |
| `/api` | API REST y servidor WebSocket en Node.js | G. Vergara |
| `/db/migrations` | Migraciones SQL versionadas de PostgreSQL + PostGIS | G. Vergara |
| `/e2e` | Pruebas de sistema automatizadas CP-01…CP-19 (Playwright) | J. Durán |
| `/infra` | Infraestructura de AWS (CloudFormation) y scripts del servidor | G. Vergara |
| `/docs` | Convenciones, decisiones técnicas, despliegue y kit del piloto | J. Carrillo |
| `/.github` | Integración continua, pruebas de sistema, despliegue y plantilla de PR | G. Vergara |

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
npm run sembrar               # datos de demostración (cuentas *@demo.agrotech.co, contraseña cosecha2026)
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

Avisos push (RF-16a · Firebase Cloud Messaging):

| Dónde | Qué |
|---|---|
| API · `FCM_CREDENCIALES` | Ruta al JSON de la cuenta de servicio (consola de Firebase → Configuración del proyecto → Cuentas de servicio). Sin ella el push queda desactivado y los avisos llegan solo por WebSocket |
| App · `app/google-services.json` | Archivo de la app Android registrada en Firebase con el paquete `co.edu.unipamplona.agrotech`. En EAS: variable de tipo archivo `GOOGLE_SERVICES_JSON` (ver `app.config.js`) |
| Teléfono | El push no funciona en Expo Go (Android): se prueba con una compilación de desarrollo (`npx expo run:android` o EAS) o con el APK |

Ninguno de los dos archivos de Firebase se sube al repositorio (`.gitignore`).
El chat y los avisos dentro de la app usan el WebSocket de la API (`/ws`, mismo puerto).

### App

```bash
cd app
cp .env.example .env          # EXPO_PUBLIC_API_URL con la IP del computador
npm install
npm start                     # escanear el QR con Expo Go
npm test
```

Modo sin conexión (AGRO-10): la app guarda su copia local en SQLite (`expo-sqlite`). En las pruebas, `expo-sqlite`
se reemplaza por el SQLite de Node 22 (`node:sqlite`, en memoria), así que el SQL de la base local se prueba tal cual.
La vista web (`npm run web`, solo para revisar pantallas) usa SQLite en WebAssembly y necesita las cabeceras
COOP/COEP que ya configura `metro.config.js`. Para probar sin señal en Android: modo avión.

## Pruebas de sistema (AGRO-14)

Suite de caja negra con Playwright Test sobre la API real (REST y WebSocket) y la app web en tamaño de teléfono, con 3G simulado y modo avión. Genera la matriz CP → veredicto para el informe de pruebas. Detalle en [e2e/README.md](e2e/README.md).

```bash
cd e2e && npm ci && npx playwright install chromium
E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/agrotech_e2e npm run preparar && npm test
```

## Producción y versión Android (AGRO-16)

| Qué | Dónde |
|---|---|
| Infraestructura AWS (ALB, EC2, RDS PostgreSQL 17 + PostGIS, S3, alarmas) | `infra/agrotech.yaml` · [docs/despliegue/RUNBOOK.md](docs/despliegue/RUNBOOK.md) · [ADR-002](docs/decisiones/ADR-002-despliegue-aws.md) |
| Despliegue de la API | Etiqueta `v*` → `.github/workflows/desplegar.yml` (OIDC + SSM, con reversión automática) |
| Fotos en S3 | `FOTOS_DRIVER=s3`, `FOTOS_S3_BUCKET`, `AWS_REGION` (credenciales por el rol de la instancia) |
| APK del piloto / AAB de Play Store | `cd app && npx eas-cli build -p android --profile piloto` (o `produccion`) |

## Piloto con la asociación (AGRO-15, AGRO-17)

Kit en [docs/piloto/](docs/piloto/README.md): validación de prototipos, protocolo, guion de tareas, SUS, consentimiento (Ley 1581) y registro. El informe de CP-12 se calcula con `cd api && npm run piloto:informe -- --sus … --tareas …`.

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
| `infra` | `cfn-lint` → `shellcheck` | Ubuntu |

Además: `e2e.yml` (pruebas de sistema en PR hacia `main`, cada noche y a demanda) y `desplegar.yml` (versiones `v*`).

Plan de fases: [docs/PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md) · Contrato de la API: [docs/API.md](docs/API.md) · Decisiones: [docs/decisiones/](docs/decisiones/).
