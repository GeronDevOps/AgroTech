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
| `GET/POST /productos`, `PATCH /productos/{id}` | JWT | CU-02, 03, 10 | 3 | Pendiente |
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
