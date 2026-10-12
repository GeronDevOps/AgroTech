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
| `POST /pedidos` | JWT · consumidor | CU-04 · RF-04 | 4 | Implementada |
| `GET /pedidos` | JWT | CU-13, CU-15 · RF-13, RF-15a | 4 | Implementada |
| `GET /pedidos/{id}` | JWT · partes del pedido | CU-13, CU-15 | 4 | Implementada |
| `PATCH /pedidos/{id}/estado` | JWT · productor del pedido | CU-13 · RF-13 | 4 | Implementada |
| `POST /pedidos/{id}/pago` | JWT · consumidor del pedido | CU-22 · RF-21 | 4 | Implementada |
| `PATCH /pedidos/{id}/pago` | JWT · consumidor del pedido | CU-22 A1 | 4 | Implementada |
| `POST /pagos/wompi/eventos` | Firma Wompi (checksum) | CU-22 · RF-21 | 4 | Implementada ([ADR-001](decisiones/ADR-001-pasarela-de-pago.md)) |
| `GET /pagos/retorno` | Pública | CU-22 | 4 | Implementada |
| `POST /sync/push` | JWT | CU-17 · RF-17 | 5 | Implementada |
| `GET /pedidos/{id}/mensajes`, `POST /pedidos/{id}/mensajes` | JWT · partes | CU-05 · RF-05 | 6 | Implementada |
| `POST /pedidos/{id}/mensajes/leidos`, `GET /mensajes` | JWT | CU-05 | 6 | Implementada |
| `POST /pedidos/{id}/calificacion` | JWT · consumidor del pedido | CU-06 · RF-06 | 6 | Implementada |
| `GET /productores/{id}/calificaciones` | JWT | CU-06 paso 4 | 6 | Implementada |
| `GET /ventas` | JWT · productor | CU-07 · RF-07 | 6 | Implementada |
| `POST /dispositivos`, `DELETE /dispositivos/{token}` | JWT | CU-16 · RF-16a | 6 | Implementada |
| `WS /ws` | JWT (primer mensaje) | CU-04, 05, 13 (tiempo real) | 6 | Implementada |
| `GET /sync/pull` | JWT | CU-17 · RF-17 | 5 | Implementada |

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
| 503 | `NO_DISPONIBLE` | El almacenamiento de fotos (S3) no respondió; no queda nada guardado y la cola de la app reintenta (5xx) |

Las fotos se guardan como `productos/<idProductor>/<id>.jpg` y `<id>_min.jpg`; si la subida o la inserción fallan se borran.

| Driver (`FOTOS_DRIVER`) | Dónde quedan | `fotoUrl` / `miniaturaUrl` |
|---|---|---|
| `local` (desarrollo) | Disco de la API, servido en `/fotos` | `FOTOS_URL_BASE` o `http(s)://<host de la petición>/fotos/…` |
| `s3` (AWS, AGRO-16) | Bucket `agrotech-imagenes-…`, cifrado, caché inmutable de 30 días | `FOTOS_URL_BASE` o `https://<bucket>.s3.<región>.amazonaws.com/…`; el teléfono descarga directo del bucket |

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

---

## Pedido (representación pública)

```json
{
  "id": "uuid", "clave": "uuid", "estado": "PENDIENTE",
  "metodoPago": "EN_LINEA", "estadoPago": "PENDIENTE",
  "total": 170000, "puntoEntrega": "Parque principal", "franjaEntrega": "Mañana",
  "motivoCancelacion": null, "fecha": "ISO-8601", "actualizadoEn": "ISO-8601", "version": 1,
  "consumidor": { "id": "uuid", "nombre": "Andrés C." },
  "productor": { "id": "uuid", "nombre": "Rosa P.", "municipio": "Pamplonita" },
  "items": [{ "idProducto": "uuid", "nombre": "Papa pastusa", "unidad": "bulto", "cantidad": 2, "precioUnitario": 85000, "subtotal": 170000 }]
}
```

- `estado`: `PENDIENTE → ACEPTADO → EN_CAMINO → ENTREGADO`, o `CANCELADO` (transiciones validadas también por trigger en la BD).
- `estadoPago`: `NO_APLICA` (contra entrega), `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO`.
- `GET /pedidos/{id}` agrega `historial` (`[{ estadoAnterior, estadoNuevo, fecha }]`) y `pago` (último intento o `null`).

## POST /pedidos · CU-04

Cabecera obligatoria `Idempotency-Key: <uuid>` (la genera el carrito y se conserva hasta que el pedido se confirma, RNF-10).

Cuerpo: `{ "items": [{ "idProducto", "cantidad" }], "puntoEntrega", "franjaEntrega": "MANANA"|"TARDE", "metodoPago"?: "CONTRA_ENTREGA"|"EN_LINEA" }`.

- Se crea **un pedido por productor** (CU-04 A3) en una sola transacción.
- Productos bloqueados con `SELECT … ORDER BY id FOR UPDATE`; el stock se descuenta en la misma transacción (CP-07).
- Precio pactado = precio vigente al confirmar (`detalle_pedido.precio_unitario`, CA-13).

| HTTP | Código | Caso |
|---|---|---|
| 201 | — | `{ clave, pedidos: [...] }` creados |
| 200 | — | Reintento con la misma clave del mismo consumidor: devuelve los mismos pedidos (CP-16) |
| 400 | `DATOS_INVALIDOS` | Falta la clave o no es UUID; ítems, punto o franja inválidos |
| 409 | `STOCK_INSUFICIENTE` | `detalles.productos: [{ idProducto, nombre, disponible, solicitado }]` |
| 409 | `CLAVE_EN_USO` | La clave pertenece a otro usuario |

## GET /pedidos

Parámetro `estado`: `activos` (por defecto: `PENDIENTE`, `ACEPTADO`, `EN_CAMINO`) o `todos`. Devuelve `{ pedidos }` del consumidor o del productor según el rol, del más reciente al más antiguo.

## PATCH /pedidos/{id}/estado · CU-13

Cuerpo: `{ "estado": "ACEPTADO"|"EN_CAMINO"|"ENTREGADO"|"CANCELADO", "version", "motivo"? }`.

| HTTP | Código | Caso |
|---|---|---|
| 200 | — | `{ pedido }` con `version + 1`; se registra en `historial_estado` y se emite `pedido.estado` |
| 400 | `DATOS_INVALIDOS` | `CANCELADO` sin `motivo` |
| 409 | `CONFLICTO_VERSION` | Otro cambio se adelantó |
| 409 | `PAGO_NO_APROBADO` | Aceptar un pedido `EN_LINEA` sin pago `APROBADO` (RF-21) |
| 409 | `TRANSICION_NO_PERMITIDA` | Salto de estado inválido; el productor solo rechaza pedidos `PENDIENTE` |
| 404 | `NO_ENCONTRADO` | No existe o no es del productor |

Rechazar (`CANCELADO`) devuelve el stock a las publicaciones. Un proceso horario cancela los `PENDIENTE` con más de `HORAS_CANCELACION` (48 h) y también devuelve el stock.

## POST /pedidos/{id}/pago · CU-22

Sin cuerpo: el monto **siempre** se calcula en el servidor (`total × 100` centavos).

| HTTP | Código | Caso |
|---|---|---|
| 201 | — | `{ pago: { referencia, estado }, urlCheckout }` firmado con `SHA256(referencia + centavos + "COP" + secretoIntegridad)` |
| 200 | — | Ya existía un intento vigente: se reutiliza |
| 409 | `METODO_CONTRA_ENTREGA` · `PEDIDO_NO_PENDIENTE` · `PAGO_YA_APROBADO` | No corresponde pagar |
| 503 | `PASARELA_NO_CONFIGURADA` | Faltan las llaves `WOMPI_*` |

La app abre `urlCheckout` en el navegador del sistema y, al volver, consulta `GET /pedidos/{id}`. La redirección no decide nada.

## PATCH /pedidos/{id}/pago · CU-22 A1

Cuerpo: `{ "metodoPago": "CONTRA_ENTREGA" }`. Devuelve el detalle del pedido con `estadoPago = NO_APLICA`. `409 PAGO_EN_CURSO` si hay un intento de menos de 30 min.

## POST /pagos/wompi/eventos · webhook

Evento `transaction.updated` de Wompi. Se verifica `checksum = SHA256(valores de signature.properties + timestamp + secretoEventos)` con comparación en tiempo constante y el `environment` configurado.

| Resultado (`200 { resultado }`) | Significado |
|---|---|
| `ACTUALIZADO` | Estado del pago y del pedido actualizados |
| `REPETIDO` / `SIN_CAMBIO` | Evento ya procesado (idempotente) |
| `MONTO_DISTINTO` | El monto no coincide: se registra en bitácora y no se aprueba |
| `IGNORADO` | Referencia ajena a AgroTech u otro tipo de evento |

`401 FIRMA_INVALIDA`: checksum o ambiente incorrecto.

## GET /pagos/retorno

`302` hacia `WOMPI_RETORNO_APP` (`agrotech://pago?id=<transacción>`): devuelve al usuario a la app tras el checkout.

---

## Sincronización sin conexión (CU-17 · RF-17)

La app guarda una copia local (SQLite) y una cola de operaciones. Al volver la señal: 1) envía la cola en orden cronológico,
2) descarga lo cambiado desde su última marca. Las publicaciones con foto (CU-02) **no** pasan por `/sync/push`:
van a `POST /productos`, que ya es idempotente por el `id` generado en el teléfono.

## POST /sync/push

Cuerpo: `{ "operaciones": [{ "idOperacion": uuid, "tipo": "PRODUCTO.EDITAR", "idEntidad": uuid, "datos": {…}, "creadoEn": ISO }] }` (1–50).

| `tipo` | Rol | `datos` | Equivale a |
|---|---|---|---|
| `PRODUCTO.EDITAR` | Productor | `{ precio?, stock?, version }` | `PATCH /productos/{id}` |
| `MENSAJE.CREAR` | Partes del pedido | `{ idPedido, contenido }` · `idEntidad` = id del mensaje | `POST /pedidos/{id}/mensajes` |
| `CALIFICACION.CREAR` | Consumidor | `{ puntuacion, comentario? }` · `idEntidad` = id del pedido | `POST /pedidos/{id}/calificacion` |

Respuesta `200 { resultados: [{ idOperacion, resultado, producto?, error? }] }`, en el mismo orden:

| `resultado` | Significado | La app |
|---|---|---|
| `PUBLICADO` | Aplicada; trae la entidad vigente | Sale de la cola y actualiza la copia |
| `YA_APLICADA` | Reenvío de una operación ya aplicada (se perdió la respuesta) | Igual que `PUBLICADO` |
| `CON_ERROR` | Rechazo de negocio (`DATOS_INVALIDOS`, `NO_ENCONTRADO`, `SIN_PERMISO`, `CONFLICTO_VERSION` con `detalles.producto`) | Queda "Con error"; en conflicto prevalece el servidor (A2) |
| `REINTENTAR` | Error temporal del servidor | Vuelve a "Pendiente" |

- Cada operación corre en su propia transacción con bloqueo por `idOperacion`; el resultado se registra en `operacion_sync` (depuración a los 30 días).
- `400 DATOS_INVALIDOS` solo si el lote está mal formado (vacío, > 50, `idOperacion` inválido o repetido).

## GET /sync/pull

Parámetros: `desde` (ISO; marca anterior) y `despuesDe` (cursor). Respuesta:

```json
{ "servidorEn": "ISO", "completa": false, "productos": [...], "hayMas": false,
  "siguiente": null, "retirados": ["uuid"], "pedidos": [...] }
```

- Sin `desde`: copia completa (`completa: true`) del catálogo visible + publicaciones propias + últimos 100 pedidos.
- Con `desde`: lo cambiado después de `desde − 2 min` (solapamiento para transacciones que confirmaron tarde); `retirados` = ids que ya no deben estar en la copia.
- Productos paginados de a 500 por cursor exacto `(actualizado_en, id)` con microsegundos (`siguiente: { desde, despuesDe }`); pedidos y retirados solo en la primera página.
- La app guarda `servidorEn` de la primera página como nueva marca.

---

## Chat por pedido (CU-05 · RF-05)

Mensaje: `{ id, idPedido, idEmisor, contenido, fecha, leido, leidoEn }`. Solo las partes del pedido (404 para los demás).

| Ruta | Detalle |
|---|---|
| `GET /pedidos/{id}/mensajes?despuesDe=ISO` | `{ abierto, estadoPedido, mensajes }` en orden cronológico (últimos 200) |
| `POST /pedidos/{id}/mensajes` | `{ id: uuid del teléfono, contenido 1–500 }` → 201; reenvío con el mismo id → 200 (A1). `409 CHAT_CERRADO` con el pedido entregado o cancelado (A2); `400` vacío o > 500 (A3); `409 ID_EN_USO` |
| `POST /pedidos/{id}/mensajes/leidos` | Marca leídos los mensajes de la contraparte → `{ leidos }` y avisa al emisor por WebSocket (paso 4) |
| `GET /mensajes` | `{ conversaciones: [{ idPedido, estadoPedido, abierto, contraparte, ultimoMensaje, sinLeer }] }` |

`GET /pedidos` y `GET /pedidos/{id}` incluyen `mensajesSinLeer` y `calificacion`.
Un disparador en la BD rechaza mensajes de pedidos cerrados o de quien no es parte (segunda barrera).

## Calificación (CU-06 · RF-06)

`POST /pedidos/{id}/calificacion` `{ puntuacion: 1–5 entero, comentario?: ≤ 300 }` → `201 { calificacion, reputacion: { promedio, total } }`.

| HTTP | Código | Caso |
|---|---|---|
| 409 | `PEDIDO_NO_ENTREGADO` | A1 |
| 409 | `YA_CALIFICADO` | A2; `detalles.calificacion` trae la existente |
| 403 / 404 | `SIN_PERMISO` / `NO_ENCONTRADO` | Productor / otro consumidor |

`GET /productores/{id}/calificaciones?pagina=` → `{ productor, reputacion, calificaciones: [{ puntuacion, comentario, fecha, consumidor: 'Andrés C.' }], hayMas }` (20 por página).

## Panel de ventas (CU-07 · RF-07)

`GET /ventas?periodo=semana|mes|mes_anterior|anio` (por defecto `mes`) o `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`.

- Una venta cuenta el **día en que el pedido pasó a ENTREGADO**, en hora de Colombia (UTC−5), por el total pactado (CA-11).
- Respuesta: `{ periodo { desde, hasta, agrupacion: dia|mes }, correccion, resumen { pedidosEntregados, ingresos, ticketPromedio }, serie [{ fecha, pedidos, ingresos }], topProductos (5), enCurso { pedidos, valor }, generadoEn }`.
- A3: fechas invertidas se intercambian, el futuro se recorta a hoy y más de 366 días se limita; `correccion` explica el ajuste. Fecha mal escrita → 400.
- Serie diaria hasta 62 días; mensual en rangos más largos.

## Dispositivos y avisos push (CU-16 · RF-16a)

- `POST /dispositivos { token (FCM), plataforma: 'ANDROID' }` → 201 nuevo / 200 existente; un token pertenece a una sola cuenta (se reasigna).
- `DELETE /dispositivos/{token}` → 204 (al cerrar sesión).
- Avisos: **pedido nuevo** (al productor) y **pedido pagado** (RF-21). Se registran en `notificacion` y se envían por FCM HTTP v1 con la cuenta de servicio de `FCM_CREDENCIALES`.
  - Falla temporal → reintento a 1, 2, 4 y 8 min; al 5.º intento `FALLIDA` (CU-04 A4). Token vencido → dispositivo `INVALIDO`. Sin teléfonos → `SIN_DISPOSITIVO` (A1: el aviso llega dentro de la app).
  - Sin `FCM_CREDENCIALES` el push está desactivado y no se registra nada.

## WebSocket `/ws` (tiempo real)

1. Conectar a `wss://<api>/ws` y en los primeros 5 s enviar `{ "tipo": "autenticar", "token": "<JWT>" }` → `{ "tipo": "listo" }`. Sin autenticar: cierre `4001`; token inválido: `4002`.
2. El servidor solo envía eventos (los cambios entran por la API REST):

| Evento | Para | Cuándo |
|---|---|---|
| `{ tipo: 'pedido_nuevo', idPedido }` | Productor | CU-04 paso 4 (CA-06) |
| `{ tipo: 'pedido_actualizado', idPedido, estado? , estadoPago? }` | Ambas partes | Cambio de estado (CA-08) o de pago |
| `{ tipo: 'mensaje', mensaje }` | Ambas partes | Mensaje nuevo (CA-09) |
| `{ tipo: 'mensajes_leidos', idPedido, idLector, ids }` | Ambas partes | CU-05 paso 4 |
| `{ tipo: 'calificacion', idPedido, reputacion }` | Productor | CA-10 |

Latido cada 30 s (ping/pong); la app reconecta con espera creciente hasta 30 s.

