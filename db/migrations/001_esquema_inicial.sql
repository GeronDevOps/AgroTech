-- =====================================================================
-- AgroTech · Migración 001 · Esquema inicial (PostgreSQL 17 + PostGIS)
-- Coherente con el modelo entidad–relación v2 (Entrega 3).
-- Se aplica con `npm run migrate` (api/src/db/migrate.js), que envuelve
-- el archivo en una transacción y lo registra en schema_migrations.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS unaccent;     -- búsqueda sin tildes (RF-11, Fase 2)

-- ---------------------------------------------------------------------
-- Tipos enumerados (únicos estados válidos)
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario     AS ENUM ('PRODUCTOR', 'CONSUMIDOR', 'ADMINISTRADOR');
CREATE TYPE estado_cuenta   AS ENUM ('ACTIVA', 'BLOQUEADA', 'SUSPENDIDA', 'ANONIMIZADA');
CREATE TYPE estado_producto AS ENUM ('ACTIVA', 'PAUSADA', 'AGOTADA', 'INACTIVA');
CREATE TYPE estado_pedido   AS ENUM ('PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO');
CREATE TYPE estado_reporte  AS ENUM ('PENDIENTE', 'EN_REVISION', 'RESUELTO', 'DESESTIMADO');
CREATE TYPE estado_token    AS ENUM ('VIGENTE', 'INVALIDO');

-- ---------------------------------------------------------------------
-- Función común: mantiene actualizado_en y version
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_tocar_fila() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  IF TG_TABLE_NAME IN ('producto', 'pedido') THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- USUARIO (herencia en una sola tabla: columna rol)
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres            VARCHAR(80)  NOT NULL,
  apellidos          VARCHAR(80)  NOT NULL,
  correo             VARCHAR(120) NOT NULL,
  telefono           VARCHAR(20)  NOT NULL,
  contrasena_hash    VARCHAR(100) NOT NULL,              -- Bcrypt; nunca la contraseña
  rol                rol_usuario  NOT NULL,
  municipio          VARCHAR(60)  NOT NULL,
  vereda_direccion   VARCHAR(150),
  coordenadas        GEOGRAPHY(Point, 4326),
  estado             estado_cuenta NOT NULL DEFAULT 'ACTIVA',
  verificado         BOOLEAN      NOT NULL DEFAULT false,
  intentos_fallidos  SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta    TIMESTAMPTZ,                         -- CU-21 A3: 5 intentos → 15 min
  fecha_registro     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_usuario_correo   UNIQUE (correo),
  CONSTRAINT uq_usuario_telefono UNIQUE (telefono)
);
CREATE INDEX ix_usuario_coordenadas ON usuario USING GIST (coordenadas);
CREATE TRIGGER tg_usuario_tocar BEFORE UPDATE ON usuario FOR EACH ROW EXECUTE FUNCTION fn_tocar_fila();

-- Autorización de tratamiento de datos (Ley 1581 de 2012)
CREATE TABLE autorizacion_datos (
  id_autorizacion   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario        UUID NOT NULL REFERENCES usuario(id_usuario),
  version_aviso     VARCHAR(20) NOT NULL,
  canal             VARCHAR(20) NOT NULL DEFAULT 'APP',
  fecha_aceptacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_autorizacion_usuario ON autorizacion_datos (id_usuario);

-- Dispositivos para notificaciones push (RF-16a, MVP)
CREATE TABLE dispositivo (
  id_dispositivo  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario      UUID NOT NULL REFERENCES usuario(id_usuario),
  token           VARCHAR(255) NOT NULL UNIQUE,
  plataforma      VARCHAR(10)  NOT NULL DEFAULT 'ANDROID',
  estado          estado_token NOT NULL DEFAULT 'VIGENTE',
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_dispositivo_usuario ON dispositivo (id_usuario) WHERE estado = 'VIGENTE';
CREATE TRIGGER tg_dispositivo_tocar BEFORE UPDATE ON dispositivo FOR EACH ROW EXECUTE FUNCTION fn_tocar_fila();

-- ---------------------------------------------------------------------
-- PRODUCTO (borrado lógico por estado)
-- ---------------------------------------------------------------------
CREATE TABLE producto (
  id_producto        UUID PRIMARY KEY,                    -- se puede generar en el teléfono (modo sin conexión)
  id_productor       UUID NOT NULL REFERENCES usuario(id_usuario),
  nombre             VARCHAR(80)   NOT NULL,
  descripcion        TEXT,
  categoria          VARCHAR(40)   NOT NULL,
  precio             NUMERIC(12,2) NOT NULL CHECK (precio > 0),
  unidad_medida      VARCHAR(20)   NOT NULL,
  stock              NUMERIC(10,2) NOT NULL CHECK (stock >= 0),   -- segunda barrera del riesgo 9
  foto_url           VARCHAR(255)  NOT NULL,
  municipio          VARCHAR(60)   NOT NULL,
  estado             estado_producto NOT NULL DEFAULT 'ACTIVA',
  version            INTEGER       NOT NULL DEFAULT 1,
  fecha_publicacion  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_producto_catalogo  ON producto (estado, municipio, categoria);   -- RNF-01
CREATE INDEX ix_producto_productor ON producto (id_productor);
CREATE INDEX ix_producto_sync      ON producto (actualizado_en);                 -- GET /sync/pull
CREATE TRIGGER tg_producto_tocar BEFORE UPDATE ON producto FOR EACH ROW EXECUTE FUNCTION fn_tocar_fila();

-- ---------------------------------------------------------------------
-- PEDIDO, DETALLE_PEDIDO, HISTORIAL_ESTADO
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
  id_pedido           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_consumidor       UUID NOT NULL REFERENCES usuario(id_usuario),
  id_productor        UUID NOT NULL REFERENCES usuario(id_usuario),
  clave_idempotencia  UUID NOT NULL,
  fecha               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  estado              estado_pedido NOT NULL DEFAULT 'PENDIENTE',
  total               NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  punto_entrega       VARCHAR(150)  NOT NULL,
  franja_entrega      VARCHAR(40)   NOT NULL,
  motivo_cancelacion  VARCHAR(150),
  version             INTEGER       NOT NULL DEFAULT 1,
  actualizado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- una misma clave genera un pedido por productor (CU-04 A3): la unicidad es por (clave, productor)
  CONSTRAINT uq_pedido_idempotencia UNIQUE (clave_idempotencia, id_productor),
  CONSTRAINT ck_pedido_partes CHECK (id_consumidor <> id_productor),
  CONSTRAINT ck_pedido_motivo CHECK (estado <> 'CANCELADO' OR motivo_cancelacion IS NOT NULL)
);
CREATE INDEX ix_pedido_productor  ON pedido (id_productor, estado);
CREATE INDEX ix_pedido_consumidor ON pedido (id_consumidor, estado);
CREATE INDEX ix_pedido_pendiente  ON pedido (fecha) WHERE estado = 'PENDIENTE';  -- tarea de 48 h
CREATE TRIGGER tg_pedido_tocar BEFORE UPDATE ON pedido FOR EACH ROW EXECUTE FUNCTION fn_tocar_fila();

CREATE TABLE detalle_pedido (
  id_detalle       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido        UUID NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,   -- composición
  id_producto      UUID NOT NULL REFERENCES producto(id_producto),
  cantidad         NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(12,2) NOT NULL CHECK (precio_unitario > 0),          -- precio pactado
  subtotal         NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  CONSTRAINT uq_detalle_producto UNIQUE (id_pedido, id_producto)
);

CREATE TABLE historial_estado (
  id_historial     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido        UUID NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,   -- composición
  id_usuario       UUID REFERENCES usuario(id_usuario),     -- NULL = cambio hecho por el sistema
  estado_anterior  estado_pedido,                           -- NULL en la creación
  estado_nuevo     estado_pedido NOT NULL,
  fecha            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_historial_pedido ON historial_estado (id_pedido, fecha);

-- Máquina de estados del pedido (diagrama de estados a): rechaza transiciones no permitidas
CREATE FUNCTION fn_validar_transicion_pedido() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  IF NOT ( (OLD.estado = 'PENDIENTE' AND NEW.estado IN ('ACEPTADO', 'CANCELADO'))
        OR (OLD.estado = 'ACEPTADO'  AND NEW.estado IN ('EN_CAMINO', 'CANCELADO'))
        OR (OLD.estado = 'EN_CAMINO' AND NEW.estado IN ('ENTREGADO', 'CANCELADO')) ) THEN
    RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.estado, NEW.estado USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_pedido_transicion BEFORE UPDATE OF estado ON pedido FOR EACH ROW EXECUTE FUNCTION fn_validar_transicion_pedido();

-- ---------------------------------------------------------------------
-- MENSAJE y CALIFICACION
-- ---------------------------------------------------------------------
CREATE TABLE mensaje (
  id_mensaje  UUID PRIMARY KEY,                        -- generado en el teléfono: reenvío idempotente
  id_pedido   UUID NOT NULL REFERENCES pedido(id_pedido),
  id_emisor   UUID NOT NULL REFERENCES usuario(id_usuario),
  contenido   VARCHAR(500) NOT NULL CHECK (length(trim(contenido)) > 0),
  fecha       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  leido       BOOLEAN      NOT NULL DEFAULT false
);
CREATE INDEX ix_mensaje_pedido ON mensaje (id_pedido, fecha);

CREATE TABLE calificacion (
  id_calificacion  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido        UUID NOT NULL UNIQUE REFERENCES pedido(id_pedido),   -- una por pedido
  puntuacion       SMALLINT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario       VARCHAR(300),
  fecha            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reputación derivada (Productor./promedioCalificacion)
CREATE VIEW v_reputacion_productor AS
SELECT p.id_productor,
       ROUND(AVG(c.puntuacion)::numeric, 2) AS promedio,
       COUNT(*)                             AS total_calificaciones
FROM calificacion c
JOIN pedido p ON p.id_pedido = c.id_pedido
GROUP BY p.id_productor;

-- Panel de ventas (RF-07): pedidos entregados por mes
CREATE VIEW v_ventas_mensuales AS
SELECT p.id_productor,
       date_trunc('month', h.fecha) AS mes,
       COUNT(DISTINCT p.id_pedido)  AS pedidos_entregados,
       SUM(p.total)                 AS ingresos
FROM pedido p
JOIN historial_estado h ON h.id_pedido = p.id_pedido AND h.estado_nuevo = 'ENTREGADO'
GROUP BY p.id_productor, date_trunc('month', h.fecha);

-- ---------------------------------------------------------------------
-- BITACORA y REPORTE (REPORTE se usa en Fase 2)
-- ---------------------------------------------------------------------
CREATE TABLE bitacora (
  id_bitacora  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario   UUID REFERENCES usuario(id_usuario),     -- NULL: sistema o credenciales de correo inexistente
  accion       VARCHAR(40) NOT NULL,
  entidad      VARCHAR(40) NOT NULL,
  id_entidad   UUID,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado    VARCHAR(20) NOT NULL
);
CREATE INDEX ix_bitacora_fecha ON bitacora (fecha);

CREATE TABLE reporte (
  id_reporte        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_reportante     UUID NOT NULL REFERENCES usuario(id_usuario),
  id_administrador  UUID REFERENCES usuario(id_usuario),
  tipo_contenido    VARCHAR(20) NOT NULL CHECK (tipo_contenido IN ('PRODUCTO', 'CALIFICACION', 'PEDIDO')),
  id_contenido      UUID NOT NULL,
  motivo            VARCHAR(40) NOT NULL,
  descripcion       TEXT,
  estado            estado_reporte NOT NULL DEFAULT 'PENDIENTE',
  resolucion        TEXT,
  fecha             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_reporte_unico UNIQUE (id_reportante, tipo_contenido, id_contenido)   -- CU-19 A1
);

