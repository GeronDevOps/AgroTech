-- =====================================================================
-- AgroTech · Migración 002 · Catálogo (AGRO-6, AGRO-7, AGRO-18)
-- Valores permitidos de categoría y unidad, e índice de orden del catálogo.
-- Los códigos coinciden con api/src/datos/catalogo.js y app/src/datos/catalogo.js.
-- =====================================================================

ALTER TABLE producto
  ADD CONSTRAINT ck_producto_categoria CHECK (categoria IN (
    'TUBERCULOS', 'HORTALIZAS', 'FRUTAS', 'GRANOS', 'CAFE_CACAO', 'PLATANO', 'LACTEOS_HUEVOS', 'OTROS')),
  ADD CONSTRAINT ck_producto_unidad CHECK (unidad_medida IN (
    'kg', 'libra', 'arroba', 'bulto', 'canastilla', 'unidad', 'docena', 'litro')),
  ADD CONSTRAINT ck_producto_nombre CHECK (length(btrim(nombre)) >= 2);

-- CU-03: el catálogo muestra solo publicaciones activas con stock, de la más reciente a la más antigua.
CREATE INDEX ix_producto_recientes ON producto (fecha_publicacion DESC, id_producto)
  WHERE estado = 'ACTIVA' AND stock > 0;
