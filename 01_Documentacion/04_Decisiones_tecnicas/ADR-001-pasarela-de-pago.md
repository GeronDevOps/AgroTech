# ADR-001 · Pasarela de pago en línea (Wompi)

| Campo | Valor |
|---|---|
| Estado | Aprobada por el Project Manager (11/10/2026) |
| Alcance | MVP · Fase 4 (Pedidos) |
| Requisito nuevo | RF-21 · Pago en línea opcional del pedido |
| Tarjeta Jira | AGRO-21 |

## Contexto

- SRS v2, supuestos: "Productor y consumidor acuerdan la entrega y el pago por fuera de la app".
- Se solicita incorporar el pago dentro de la app sin excluir a productores sin cuenta bancaria ni a consumidores sin tarjeta.

## Decisión

| Aspecto | Decisión |
|---|---|
| Pasarela | Wompi (Colombia): tarjetas, PSE, Nequi, Daviplata, Botón Bancolombia |
| Modalidad | **Opcional**: el pedido se paga *contra entrega* (como hasta ahora) o *en línea* |
| Integración | Web Checkout alojado por Wompi (redirección). AgroTech nunca recibe datos de tarjeta → PCI-DSS fuera de alcance |
| Confirmación del pago | Solo por evento `transaction.updated` (webhook) con checksum verificado; la redirección es informativa |
| Recaudo | Centralizado en la cuenta de comercio de AgroTech; liquidación al productor por fuera de la app con el reporte de pagos aprobados |
| Entorno | Sandbox (`pub_test_…`) durante el proyecto; producción requiere la cuenta de comercio de la asociación |

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Mercado Pago (split 1:1) | Exige que cada productor tenga cuenta de Mercado Pago y la vincule por OAuth: barrera alta para el usuario rural |
| Pago solo en línea | Excluye a consumidores sin medios digitales y contradice el pago contra entrega del piloto |
| Integración directa por API de tarjetas | Obliga a manejar datos de tarjeta (PCI-DSS) |

## Diseño

### Flujo (CU-04 extendido por CU-22 · Pagar pedido en línea)

1. El consumidor confirma el pedido eligiendo `metodo_pago = EN_LINEA` → `POST /api/v1/pedidos` (idempotente). El pedido queda `PENDIENTE` con `estado_pago = PENDIENTE`.
2. La app pide `POST /api/v1/pedidos/{id}/pago`. La API crea el registro `pago`, calcula el monto **en el servidor** desde `pedido.total` y firma: `SHA256(referencia + monto_en_centavos + "COP" + secreto_integridad)`.
3. La API devuelve la URL `https://checkout.wompi.co/p/?public-key=…&currency=COP&amount-in-cents=…&reference=…&signature:integrity=…&redirect-url=…`.
4. La app abre la URL en el navegador del sistema; el consumidor paga en Wompi.
5. Wompi envía `transaction.updated` a `POST /api/v1/pagos/wompi/eventos`. La API verifica `SHA256(valores de signature.properties + timestamp + secreto_eventos)` contra `signature.checksum`, actualiza `pago` y `pedido.estado_pago` en una transacción y responde 200.
6. `APROBADO` → se notifica al productor (nuevo pedido pagado). `RECHAZADO`/`ERROR` → el consumidor puede reintentar o cambiar a contra entrega.

### Modelo de datos (migración en Fase 4)

- `pedido.metodo_pago` ENUM (`CONTRA_ENTREGA`, `EN_LINEA`), por defecto `CONTRA_ENTREGA`.
- `pedido.estado_pago` ENUM (`NO_APLICA`, `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO`).
- Tabla `pago`: `id_pago` UUID PK, `id_pedido` FK, `referencia` UNIQUE, `monto_centavos` BIGINT CHECK > 0, `moneda` CHAR(3), `id_transaccion_wompi` UNIQUE, `estado`, `medio`, `evento` JSONB, `creado_en`, `actualizado_en`.

### Reglas de negocio

- El productor solo puede aceptar un pedido `EN_LINEA` con `estado_pago = APROBADO`.
- El evento es idempotente: un `id_transaccion_wompi` con el mismo estado no se reprocesa.
- Un pago `PENDIENTE` sin evento final en 30 min libera el pedido para reintento o cambio a contra entrega.
- Sin conexión el pago no está disponible (igual que confirmar el pedido).

### Seguridad

- `WOMPI_LLAVE_PUBLICA`, `WOMPI_SECRETO_INTEGRIDAD` y `WOMPI_SECRETO_EVENTOS` solo en `api/.env` / AWS; nunca en la app ni en el repositorio.
- Comparación del checksum con `crypto.timingSafeEqual`.
- El endpoint de eventos es público pero rechaza todo evento sin checksum válido o con `environment` distinto al configurado.

## Impacto

| Artefacto | Cambio |
|---|---|
| SRS (E1) | RF-21, CU-22, ajuste del supuesto de pago, RNF-04 (secretos de pasarela) |
| Diseño (E3) | Entidad `PAGO` en el E-R, clase `Pago`, secuencia de pago, estados de pago, endpoints nuevos |
| Plan (E4) | Riesgos RSGR nuevos: caída de la pasarela, evento no recibido, fraude/contracargo; PF y cronograma de la fase 4 |
| Repositorio | Migración 002/003, módulo `pagos` en la API, pantalla de pago en la app |
