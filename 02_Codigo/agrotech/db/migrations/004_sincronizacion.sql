-- =====================================================================
-- AgroTech · Migración 004 · Sincronización sin conexión (RF-17 · CU-17)
-- AGRO-10: POST /sync/push (cola del teléfono) y GET /sync/pull (cambios desde la última sincronización)
-- =====================================================================

-- Resultado registrado de cada operación de la cola. Permite responder "ya aplicada" cuando el
-- teléfono reenvía una operación cuya respuesta se perdió (idempotencia por id_operacion, RNF-03).
CREATE TYPE resultado_sync AS ENUM ('PUBLICADO', 'CON_ERROR');

CREATE TABLE operacion_sync (
  id_operacion   UUID PRIMARY KEY,                               -- generado en el teléfono
  id_usuario     UUID NOT NULL REFERENCES usuario(id_usuario),
  tipo           VARCHAR(40)    NOT NULL,                        -- p. ej. PRODUCTO.EDITAR
  id_entidad     UUID,
  resultado      resultado_sync NOT NULL,
  respuesta      JSONB          NOT NULL,                        -- entidad resultante o error { codigo, mensaje, detalles }
  creado_en_app  TIMESTAMPTZ,                                    -- cuándo se encoló en el teléfono
  procesado_en   TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_operacion_sync_procesado ON operacion_sync (procesado_en);   -- depuración a los 30 días

-- GET /sync/pull: pedidos del usuario cambiados desde la última sincronización.
CREATE INDEX ix_pedido_consumidor_sync ON pedido (id_consumidor, actualizado_en);
CREATE INDEX ix_pedido_productor_sync  ON pedido (id_productor, actualizado_en);
-- Paginación por cursor (actualizado_en, id_producto) del pull de productos.
CREATE INDEX ix_producto_sync_cursor   ON producto (actualizado_en, id_producto);
