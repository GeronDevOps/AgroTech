# Convenciones del equipo AgroTech

Se basan en la Entrega 2 (Organización metodológica), secciones 3.1 y 3.3.

## Ramas

| Rama | Uso | Reglas |
|---|---|---|
| `main` | Producción (versión publicada) | Protegida: solo recibe merges desde `develop` al cerrar una entrega |
| `develop` | Integración | Protegida: solo por Pull Request con revisión y CI en verde |
| `feature/AGRO-<n>-descripcion` | Una por tarjeta de Jira | Se crea desde `develop` y se borra al integrar |

### Protección en GitHub

Ruta: Settings → Branches → Add rule.

| Opción | `main` | `develop` |
|---|---|---|
| Require a pull request before merging | ✔ | ✔ |
| Require approvals: 1 | ✔ | ✔ |
| Require status checks to pass (jobs `api` y `app`) | ✔ | ✔ |
| Do not allow bypassing the above settings | ✔ | ✔ |

## Commits

Formato: `AGRO-<n>: descripción breve en infinitivo`.

```text
AGRO-5: agregar endpoint de inicio de sesión
AGRO-8: bloquear inventario en orden fijo al confirmar pedido
```

Jira enlaza automáticamente el commit con la tarjeta.

## Definición de Terminado

Una tarjeta pasa a **Terminado** cuando cumple todo lo siguiente:

- [ ] El código está integrado a `develop` mediante un Pull Request.
- [ ] Otro integrante revisó el Pull Request.
- [ ] Las pruebas de GitHub Actions pasan.
- [ ] QA verificó el criterio de aceptación (CA) de la tarjeta.
- [ ] No hay errores críticos abiertos.

## Estructura de la API (capas)

```text
api/src/
  app.js                 # crea la aplicación Express (sin abrir el puerto)
  server.js              # abre el puerto HTTP (y más adelante el WebSocket)
  config/                # variables de entorno validadas
  db/                    # pool de conexiones y ejecutor de migraciones
  middleware/            # errores, autenticación, validación
  utils/                 # errores HTTP y utilidades
  modules/<modulo>/
    <modulo>.routes.js        # rutas /api/v1/...
    <modulo>.controller.js    # traduce HTTP ↔ servicio
    <modulo>.service.js       # reglas de negocio
    <modulo>.repository.js    # SQL parametrizado
```

**Reglas:**

- Solo los repositorios hablan con PostgreSQL.
- Los servicios no conocen Express.
- Toda consulta SQL es parametrizada (`$1, $2…`); nunca se concatenan valores del usuario.
- Las rutas protegidas usan `autenticar(tokens)` y, si dependen del rol, `autorizar('PRODUCTOR')` (ver `src/middleware/autenticacion.js`).
- Nunca se registra en logs ni se devuelve `contrasena_hash`, tokens o secretos.

## Migraciones

- Un archivo por cambio: `NNN_descripcion.sql` (`002_…`, `003_…`).
- Una migración ya integrada a `develop` **no se edita**; se corrige con una nueva.
- Cada archivo se aplica dentro de una transacción y queda registrado en `schema_migrations`.

## Errores de la API

Formato único de respuesta de error:

```json
{ "error": { "codigo": "STOCK_INSUFICIENTE", "mensaje": "No hay suficiente papa pastusa." } }
```

| HTTP | Cuándo |
|---|---|
| 400 | Datos inválidos |
| 401 | Sin token válido (`NO_AUTENTICADO`, `SESION_EXPIRADA`) o credenciales inválidas (`CREDENCIALES_INVALIDAS`) |
| 403 | Sin permiso por rol (`SIN_PERMISO`) o cuenta suspendida (`CUENTA_SUSPENDIDA`) |
| 423 | Cuenta bloqueada temporalmente (`CUENTA_BLOQUEADA`) |
| 404 | Recurso inexistente |
| 409 | Conflicto de stock, de versión, de transición de estado o cuenta existente (`CUENTA_EXISTENTE`) |
| 500 | Error no controlado (se registra; no se exponen detalles) |
