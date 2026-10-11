# Contrato de la API REST · v1

Base: `/api/v1` · JSON UTF-8 · Errores: `{ "error": { "codigo", "mensaje", "detalles?" } }` (ver [CONTRIBUTING](CONTRIBUTING.md#errores-de-la-api)).
Autenticación: cabecera `Authorization: Bearer <token>` en las rutas marcadas con JWT.

## Índice

| Método y ruta | Acceso | CU · RF | Fase | Estado |
|---|---|---|---|---|
| `GET /salud` | Pública | RNF-07 | 1 | Implementada |
| `POST /auth/registro` | Pública | CU-01 · RF-01 | 2 | Implementada |
| `POST /auth/sesion` | Pública | CU-21 · RF-01 | 2 | Implementada |
| `GET /auth/yo` | JWT | CU-21 | 2 | Implementada |
| `GET /productos` | JWT | CU-03 · RF-03 | 3 | Implementada |
| `GET /productos/mios` | JWT · productor | CU-02, CU-10 | 3 | Implementada |
| `GET /productos/{id}` | JWT | CU-03 | 3 | Implementada |
| `POST /productos` | JWT · productor | CU-02 · RF-02 | 3 | Implementada |
| `PATCH /productos/{id}` | JWT · productor dueño | CU-10 · RF-10a | 3 | Implementada |
| `POST /pedidos`, `GET /pedidos`, `PATCH /pedidos/{id}/estado` | JWT | CU-04, 13, 15 | 4 | Pendiente |
| `POST /pedidos/{id}/pago`, `POST /pagos/wompi/eventos` | JWT / firma Wompi | CU-22 · RF-21 | 4 | Diseñada ([ADR-001](decisiones/ADR-001-pasarela-de-pago.md)) |

---

## POST /auth/registro · CU-01

**Cuerpo**

| Campo | Tipo | Regla |
|---|---|---|
| `nombres`, `apellidos` | string | 2–80 caracteres, solo letras, espacios, `'`, `.`, `-` |
| `correo` | string | Formato de correo, ≤ 120; se guarda en minúsculas; único |
| `telefono` | string | Celular colombiano `3XXXXXXXXX`; acepta espacios, guiones y `+57`; único |
| `contrasena` | string | 8–72 bytes, al menos una letra y un número |
| `rol` | string | `PRODUCTOR` o `CONSUMIDOR` |
| `municipio` | string | Uno de los 40 municipios de Norte de Santander (tolera tildes/mayúsculas) |
| `veredaDireccion` | string? | ≤ 150 |
| `aceptaTratamientoDatos` | boolean | Debe ser `true` (Ley 1581 de 2012) |

**Efectos (una transacción):** `usuario` (hash Bcrypt costo 12) + `autorizacion_datos` (versión del aviso, canal `APP`) + `bitacora` (`REGISTRO/EXITOSO`).

**Respuestas**

| HTTP | Código | Caso |
|---|---|---|
| 201 | — | `{ token, tipo: "Bearer", expiraEn, usuario }` (la sesión queda abierta) |
| 400 | `DATOS_INVALIDOS` | `detalles.campos = { campo: mensaje }` (A2, A3) |
| 409 | `CUENTA_EXISTENTE` | `detalles.campo = "correo" \| "telefono"` (A1) |

## POST /auth/sesion · CU-21

**Cuerpo:** `{ "identificador": "<correo o celular>", "contrasena": "..." }`

| HTTP | Código | Caso |
|---|---|---|
| 200 | — | `{ token, tipo, expiraEn, usuario }`; reinicia intentos fallidos |
| 401 | `CREDENCIALES_INVALIDAS` | Mismo mensaje si el usuario no existe o la contraseña es errada (A1) |
| 423 | `CUENTA_BLOQUEADA` | Quinto intento fallido o bloqueo vigente; `detalles.bloqueadoHasta` (ISO 8601) |
| 403 | `CUENTA_SUSPENDIDA` | Solo se informa si la contraseña es correcta (A2) |

**Política de bloqueo:** 5 intentos fallidos consecutivos → `bloqueado_hasta = now() + 15 min` (actualización atómica en SQL). Durante el bloqueo no se evalúa la contraseña. Bitácora: `INICIO_SESION/{EXITOSO|FALLIDO|BLOQUEADO|RECHAZADO}`, `BLOQUEO_CUENTA/EXITOSO`.

## GET /auth/yo · JWT

| HTTP | Código | Caso |
|---|---|---|
| 200 | — | `{ usuario }` |
| 401 | `NO_AUTENTICADO` | Sin token, token alterado o firmado con otro secreto |
| 401 | `SESION_EXPIRADA` | Token vencido o cuenta ya no activa |

## Token JWT

| Atributo | Valor |
|---|---|
| Algoritmo | HS256 con `JWT_SECRETO` (≥ 32 caracteres) |
| Contenido | `sub` = id del usuario, `rol`, `iss = agrotech-api`, `aud = agrotech-app`, `exp` |
| Vigencia | `JWT_EXPIRA_EN` (7 días): el usuario rural no depende de la red cada vez que abre la app |
| Almacenamiento en el teléfono | `expo-secure-store` (Android Keystore), nunca en SQLite |

---

## Producto (representación pública)

```json
{
  "id": "uuid", "nombre": "Papa pastusa", "descripcion": "…", "categoria": "TUBERCULOS",
  "precio": 85000, "unidad": "bulto", "stock": 20, "estado": "ACTIVA", "municipio": "Pamplonita", "version": 1,
  "fotoUrl": "https://…/productos/<idProductor>/<id>.jpg", "miniaturaUrl": "https://…/<id>_min.jpg",
  "fechaPublicacion": "ISO 8601", "actualizadoEn": "ISO 8601",
  "productor": { "id": "uuid", "nombre": "Rosa P.", "verificado": false, "calificacion": { "promedio": null, "total": 0 } }
}
```

- `precio`: pesos enteros (50 – 50.000.000). `stock`: hasta 2 decimales.
- `categoria`: `TUBERCULOS`, `HORTALIZAS`, `FRUTAS`, `GRANOS`, `CAFE_CACAO`, `PLATANO`, `LACTEOS_HUEVOS`, `OTROS`.
- `unidad`: `kg`, `libra`, `arroba`, `bulto`, `canastilla`, `unidad`, `docena`, `litro` (CHECK en la migración 002).
- Del productor solo se expone nombre e inicial del apellido (RNF-05).

## POST /productos · CU-02

`multipart/form-data` con tres partes:

| Parte | Regla |
|---|---|
| `foto` | JPEG ≤ 300 KB (RNF-09); la app la envía a 1024 px |
| `miniatura` | JPEG ≤ 40 KB; la app la envía a 320 px. 20 miniaturas ≈ 400 KB → primera página ≤ 500 KB |
| `datos` | JSON: `id` (UUID generado en el teléfono, opcional), `nombre`, `descripcion?`, `categoria`, `unidad`, `precio`, `stock` (> 0), `municipio` |

| HTTP | Código | Caso |
|---|---|---|
| 201 | — | `{ producto }` publicado en estado `ACTIVA` |
| 200 | — | Reintento con el mismo `id` del mismo productor: devuelve el existente sin duplicar (cola sin conexión, CU-17) |
| 400 | `DATOS_INVALIDOS` | `detalles.campos` (A2: sin foto, precio o cantidad inválidos) |
| 409 | `ID_EN_USO` | El `id` pertenece a otro productor |
| 413 | `FOTO_MUY_GRANDE` | Foto > 300 KB |

Las fotos se guardan como `productos/<idProductor>/<id>.jpg` y `<id>_min.jpg`; si la inserción falla se borran.

## PATCH /productos/{id} · CU-10 / RF-10a

Cuerpo: `{ "precio"?: entero, "stock"?: ≥ 0, "version": entero }` (al menos uno de precio o stock).

| HTTP | Código | Caso |
|---|---|---|
| 200 | — | `{ producto }` con `version + 1`. `stock = 0` → `AGOTADA` (A3); `stock > 0` sobre `AGOTADA` → `ACTIVA` |
| 409 | `CONFLICTO_VERSION` | La versión no coincide; `detalles.producto` trae la vigente (CP-17) |
| 404 | `NO_ENCONTRADO` | No existe o no es del productor (no se revela cuál) |

Los pedidos ya creados conservan el precio pactado en `detalle_pedido` (CA-13).

## GET /productos · CU-03

Parámetros: `municipio`, `categoria`, `precioMin`, `precioMax`, `pagina` (≥ 1), `tamano` (1–50, por defecto 20).
Solo publicaciones `ACTIVA` con `stock > 0` de cuentas activas, de la más reciente a la más antigua.

Respuesta: `{ productos: [...], pagina, tamano, total, hayMas }`.

## GET /productos/{id} y GET /productos/mios

- `/{id}`: cualquier usuario ve `ACTIVA` y `AGOTADA`; `PAUSADA` e `INACTIVA` solo su dueño.
- `/mios`: todas las publicaciones del productor salvo las retiradas, de la más recién modificada a la más antigua.
