-- =====================================================================
-- AgroTech · Migración 005 · Comunicación y ventas
-- AGRO-11 chat por pedido (RF-05) · AGRO-12 calificación (RF-06)
-- AGRO-13 panel de ventas (RF-07) · AGRO-20 aviso push de nuevo pedido (RF-16a)
-- =====================================================================

-- ---------------------------------------------------------------------
-- MENSAJE: el chat queda en solo lectura con el pedido entregado o cancelado (CU-05 A2)
-- ---------------------------------------------------------------------
ALTER TABLE mensaje ADD COLUMN leido_en TIMESTAMPTZ;
CREATE INDEX ix_mensaje_no_leido ON mensaje (id_pedido, id_emisor) WHERE NOT leido;

CREATE FUNCTION fn_validar_mensaje() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p pedido%ROWTYPE;
BEGIN
  SELECT * INTO p FROM pedido WHERE id_pedido = NEW.id_pedido;
  IF NEW.id_emisor NOT IN (p.id_consumidor, p.id_productor) THEN
    RAISE EXCEPTION 'El emisor no es parte del pedido' USING ERRCODE = 'P0001';
  END IF;
  IF p.estado IN ('ENTREGADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'El chat del pedido está cerrado' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_mensaje_validar BEFORE INSERT ON mensaje FOR EACH ROW EXECUTE FUNCTION fn_validar_mensaje();

-- ---------------------------------------------------------------------
-- CALIFICACION: solo de pedidos entregados (CU-06 A1); una por pedido (UNIQUE de la migración 001)
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_validar_calificacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT estado FROM pedido WHERE id_pedido = NEW.id_pedido) <> 'ENTREGADO' THEN
    RAISE EXCEPTION 'Solo se califican pedidos entregados' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_calificacion_validar BEFORE INSERT ON calificacion FOR EACH ROW EXECUTE FUNCTION fn_validar_calificacion();
CREATE INDEX ix_calificacion_fecha ON calificacion (fecha DESC);

-- ---------------------------------------------------------------------
-- Panel de ventas (RF-07): las ventas se fechan con el paso a ENTREGADO
-- ---------------------------------------------------------------------
CREATE INDEX ix_historial_entregado ON historial_estado (fecha) WHERE estado_nuevo = 'ENTREGADO';

-- ---------------------------------------------------------------------
-- NOTIFICACION: bandeja de salida de los avisos push (RF-16a; CU-04 A4 "se reintenta el aviso")
-- ---------------------------------------------------------------------
CREATE TYPE estado_envio AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA', 'SIN_DISPOSITIVO');

CREATE TABLE notificacion (
  id_notificacion  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario       UUID NOT NULL REFERENCES usuario(id_usuario),
  tipo             VARCHAR(30)  NOT NULL,                 -- PEDIDO_NUEVO, PEDIDO_PAGADO
  titulo           VARCHAR(80)  NOT NULL,
  cuerpo           VARCHAR(200) NOT NULL,
  datos            JSONB        NOT NULL DEFAULT '{}',    -- { idPedido } para abrir la pantalla al tocarla
  estado_envio     estado_envio NOT NULL DEFAULT 'PENDIENTE',
  intentos         SMALLINT     NOT NULL DEFAULT 0,
  proximo_intento  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ultimo_error     VARCHAR(200),
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  enviado_en       TIMESTAMPTZ
);
CREATE INDEX ix_notificacion_pendiente ON notificacion (proximo_intento) WHERE estado_envio = 'PENDIENTE';
CREATE INDEX ix_notificacion_usuario ON notificacion (id_usuario, creado_en DESC);
