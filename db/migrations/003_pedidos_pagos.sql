-- =====================================================================
-- AgroTech · Migración 003 · Pedidos con pago en línea opcional (RF-21 · ADR-001)
-- AGRO-8 (confirmar pedido), AGRO-9 (estados), AGRO-19 (pedidos activos), AGRO-21 (pago Wompi)
-- =====================================================================

CREATE TYPE metodo_pago        AS ENUM ('CONTRA_ENTREGA', 'EN_LINEA');
CREATE TYPE estado_pago        AS ENUM ('NO_APLICA', 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO');
CREATE TYPE estado_transaccion AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ANULADA', 'ERROR');

-- ---------------------------------------------------------------------
-- PEDIDO: método y estado del pago
-- ---------------------------------------------------------------------
ALTER TABLE pedido
  ADD COLUMN metodo_pago metodo_pago NOT NULL DEFAULT 'CONTRA_ENTREGA',
  ADD COLUMN estado_pago estado_pago NOT NULL DEFAULT 'NO_APLICA',
  ADD CONSTRAINT ck_pedido_pago CHECK (
        (metodo_pago = 'CONTRA_ENTREGA' AND estado_pago = 'NO_APLICA')
     OR (metodo_pago = 'EN_LINEA'       AND estado_pago <> 'NO_APLICA'));

-- Un pedido en línea solo se acepta con el pago aprobado (ADR-001, reglas de negocio).
CREATE FUNCTION fn_validar_pago_al_aceptar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'ACEPTADO' AND OLD.estado = 'PENDIENTE'
     AND NEW.metodo_pago = 'EN_LINEA' AND NEW.estado_pago <> 'APROBADO' THEN
    RAISE EXCEPTION 'El pedido se paga en línea y el pago no está aprobado' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_pedido_pago_aceptar BEFORE UPDATE OF estado ON pedido
  FOR EACH ROW EXECUTE FUNCTION fn_validar_pago_al_aceptar();

-- Consultas de "Mis pedidos" y "Pedidos recibidos" ordenadas por fecha (CU-15, CU-13)
CREATE INDEX ix_pedido_consumidor_fecha ON pedido (id_consumidor, fecha DESC);
CREATE INDEX ix_pedido_productor_fecha  ON pedido (id_productor, fecha DESC);

-- ---------------------------------------------------------------------
-- PAGO: cada intento de pago en la pasarela (Wompi)
-- ---------------------------------------------------------------------
CREATE TABLE pago (
  id_pago         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido       UUID NOT NULL REFERENCES pedido(id_pedido),
  referencia      VARCHAR(60)  NOT NULL,                 -- referencia única enviada a la pasarela
  monto_centavos  BIGINT       NOT NULL CHECK (monto_centavos > 0),   -- calculado en el servidor
  moneda          CHAR(3)      NOT NULL DEFAULT 'COP',
  id_transaccion  VARCHAR(64),                           -- id de la transacción en la pasarela
  estado          estado_transaccion NOT NULL DEFAULT 'PENDIENTE',
  medio           VARCHAR(30),                           -- CARD, PSE, NEQUI, DAVIPLATA, BANCOLOMBIA…
  evento          JSONB,                                 -- último evento verificado (auditoría)
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_pago_referencia  UNIQUE (referencia),
  CONSTRAINT uq_pago_transaccion UNIQUE (id_transaccion)
);
CREATE INDEX ix_pago_pedido ON pago (id_pedido, creado_en DESC);
-- Un solo intento vigente (pendiente o aprobado) por pedido: evita cobrar dos veces.
CREATE UNIQUE INDEX ux_pago_vigente ON pago (id_pedido) WHERE estado IN ('PENDIENTE', 'APROBADA');
CREATE TRIGGER tg_pago_tocar BEFORE UPDATE ON pago FOR EACH ROW EXECUTE FUNCTION fn_tocar_fila();
