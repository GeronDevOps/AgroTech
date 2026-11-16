-- =====================================================================
-- AgroTech · Migración 006 · Requisitos de la Fase 2 del SRS (v1.1.0)
-- AGRO-22 RF-08 recuperar contraseña      AGRO-23 RF-09 perfil · RF-20 datos personales
-- AGRO-24 RF-10 pausar / retirar           AGRO-25 RF-11 búsqueda · RF-12 cercanía
-- AGRO-26 RF-14 cancelar · RF-15 historial AGRO-27 RF-16 avisos push y bandeja
-- AGRO-28 RF-19 reportes                   AGRO-29 RF-18 administración y moderación
-- =====================================================================

-- ---------------------------------------------------------------------
-- MUNICIPIO: cabeceras municipales de Norte de Santander (RF-12, CU-09 paso 3)
-- Coordenadas aproximadas de la cabecera (WGS84). Sirven para "Cerca de mí" cuando el
-- usuario no comparte la ubicación del teléfono (CU-12 A1) y para recalcular el perfil.
-- ---------------------------------------------------------------------
CREATE TABLE municipio (
  nombre     VARCHAR(60) PRIMARY KEY,
  ubicacion  GEOGRAPHY(Point, 4326) NOT NULL
);

INSERT INTO municipio (nombre, ubicacion)
SELECT nombre, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
FROM (VALUES
  ('Ábrego', 8.0808, -73.2214), ('Arboledas', 7.6431, -72.7989), ('Bochalema', 7.6108, -72.6469),
  ('Bucarasica', 8.0406, -72.8667), ('Cáchira', 7.7414, -73.0483), ('Cácota', 7.2678, -72.6417),
  ('Chinácota', 7.6031, -72.6011), ('Chitagá', 7.1378, -72.6647), ('Convención', 8.4697, -73.3372),
  ('Cúcuta', 7.8939, -72.5078), ('Cucutilla', 7.5394, -72.7731), ('Durania', 7.7139, -72.6575),
  ('El Carmen', 8.5106, -73.4475), ('El Tarra', 8.5756, -73.0942), ('El Zulia', 7.9375, -72.6047),
  ('Gramalote', 7.9167, -72.7958), ('Hacarí', 8.3217, -73.1450), ('Herrán', 7.5064, -72.4836),
  ('La Esperanza', 7.6406, -73.3297), ('La Playa', 8.2153, -73.2386), ('Labateca', 7.2989, -72.4956),
  ('Los Patios', 7.8378, -72.5039), ('Lourdes', 7.9453, -72.8331), ('Mutiscua', 7.3006, -72.7469),
  ('Ocaña', 8.2378, -73.3561), ('Pamplona', 7.3756, -72.6478), ('Pamplonita', 7.4378, -72.6375),
  ('Puerto Santander', 8.3617, -72.4064), ('Ragonvalia', 7.5772, -72.4769), ('Salazar', 7.7739, -72.8128),
  ('San Calixto', 8.4017, -73.2081), ('San Cayetano', 7.8764, -72.6247), ('Santiago', 7.8653, -72.7172),
  ('Sardinata', 8.0828, -72.8000), ('Silos', 7.2050, -72.7569), ('Teorama', 8.4378, -73.2867),
  ('Tibú', 8.6392, -72.7358), ('Toledo', 7.3097, -72.4831), ('Villa Caro', 7.9142, -72.9728),
  ('Villa del Rosario', 7.8336, -72.4742)
) AS m(nombre, lat, lon);

-- Usuarios existentes sin coordenadas: se ubican en la cabecera de su municipio.
UPDATE usuario u SET coordenadas = m.ubicacion
FROM municipio m WHERE m.nombre = u.municipio AND u.coordenadas IS NULL;

-- ---------------------------------------------------------------------
-- USUARIO: versión de sesión (RF-08 paso 4 "cierra las sesiones activas", suspensión y supresión)
-- El JWT lleva la versión; al incrementarla todos los tokens anteriores dejan de valer.
-- ---------------------------------------------------------------------
ALTER TABLE usuario
  ADD COLUMN version_sesion INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN foto_url       VARCHAR(255),                 -- CU-09 paso 2 (opcional)
  ADD COLUMN motivo_estado  VARCHAR(200);                 -- motivo de la suspensión (CU-18)

-- ---------------------------------------------------------------------
-- RECUPERACION_CONTRASENA (RF-08 · CU-08): código de un solo uso, 15 minutos, 3 intentos
-- Se guarda el hash SHA-256 del código, nunca el código.
-- ---------------------------------------------------------------------
CREATE TABLE recuperacion_contrasena (
  id_recuperacion  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario       UUID NOT NULL REFERENCES usuario(id_usuario),
  codigo_hash      CHAR(64)    NOT NULL,
  expira_en        TIMESTAMPTZ NOT NULL,
  intentos         SMALLINT    NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  usado_en         TIMESTAMPTZ,
  invalidado_en    TIMESTAMPTZ,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A lo sumo un código vigente por usuario: pedir uno nuevo invalida el anterior.
CREATE UNIQUE INDEX ux_recuperacion_vigente ON recuperacion_contrasena (id_usuario)
  WHERE usado_en IS NULL AND invalidado_en IS NULL;

-- ---------------------------------------------------------------------
-- SOLICITUD_SUPRESION (RF-20 · CU-20 · Ley 1581 de 2012, art. 15: 15 días hábiles)
-- ---------------------------------------------------------------------
CREATE TYPE estado_supresion AS ENUM ('PENDIENTE', 'APLAZADA', 'COMPLETADA', 'DESISTIDA');

CREATE TABLE solicitud_supresion (
  id_solicitud      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario        UUID NOT NULL REFERENCES usuario(id_usuario),
  estado            estado_supresion NOT NULL DEFAULT 'PENDIENTE',
  motivo            VARCHAR(300),
  fecha_solicitud   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_limite      DATE        NOT NULL,              -- plazo legal (15 días hábiles)
  fecha_resolucion  TIMESTAMPTZ,
  observacion       VARCHAR(300)
);
CREATE UNIQUE INDEX ux_supresion_abierta ON solicitud_supresion (id_usuario)
  WHERE estado IN ('PENDIENTE', 'APLAZADA');

-- ---------------------------------------------------------------------
-- CALIFICACION: el administrador puede ocultar un comentario ofensivo (CU-18 paso 2)
-- ---------------------------------------------------------------------
ALTER TABLE calificacion ADD COLUMN oculta BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- REPORTE (RF-19 · CU-19 y RF-18 · CU-18): decisión del administrador
-- ---------------------------------------------------------------------
CREATE TYPE decision_reporte AS ENUM ('DESESTIMAR', 'OCULTAR', 'SUSPENDER');

ALTER TABLE reporte
  ADD COLUMN id_reportado      UUID REFERENCES usuario(id_usuario),   -- dueño del contenido reportado
  ADD COLUMN decision          decision_reporte,
  ADD COLUMN malintencionado   BOOLEAN NOT NULL DEFAULT false,         -- CU-18 A1
  ADD COLUMN fecha_resolucion  TIMESTAMPTZ,
  ADD CONSTRAINT ck_reporte_motivo CHECK (motivo IN (
    'PUBLICACION_ENGANOSA', 'PRECIO_ABUSIVO', 'CONTENIDO_OFENSIVO', 'INCUMPLIMIENTO_ENTREGA', 'FRAUDE', 'OTRO')),
  ADD CONSTRAINT ck_reporte_otro CHECK (motivo <> 'OTRO' OR length(btrim(coalesce(descripcion, ''))) >= 10),  -- CU-19 A2
  ADD CONSTRAINT ck_reporte_resuelto CHECK (
    (estado IN ('RESUELTO', 'DESESTIMADO')) = (decision IS NOT NULL AND id_administrador IS NOT NULL));
CREATE INDEX ix_reporte_estado ON reporte (estado, fecha);
CREATE INDEX ix_reporte_reportado ON reporte (id_reportado);

-- ---------------------------------------------------------------------
-- NOTIFICACION: bandeja interna (CU-16 A1/A3). Todo aviso queda en la bandeja aunque no haya push.
-- ---------------------------------------------------------------------
ALTER TYPE estado_envio ADD VALUE IF NOT EXISTS 'SOLO_BANDEJA';   -- push desactivado: solo bandeja
ALTER TABLE notificacion ADD COLUMN leida_en TIMESTAMPTZ;
CREATE INDEX ix_notificacion_no_leida ON notificacion (id_usuario) WHERE leida_en IS NULL;

-- ---------------------------------------------------------------------
-- PRODUCTO: búsqueda por texto sin tildes ni mayúsculas (RF-11 · CU-11 paso 2)
-- unaccent() no es IMMUTABLE; se envuelve para poder indexar.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_texto_busqueda(t TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, coalesce(t, ''))) $$;
CREATE INDEX ix_producto_busqueda ON producto (fn_texto_busqueda(nombre || ' ' || coalesce(descripcion, '')))
  WHERE estado = 'ACTIVA';

-- ---------------------------------------------------------------------
-- PEDIDO: historial con filtros por estado y fecha (RF-15 · CU-15 paso 2)
-- ---------------------------------------------------------------------
CREATE INDEX ix_pedido_consumidor_estado_fecha ON pedido (id_consumidor, estado, fecha DESC);
