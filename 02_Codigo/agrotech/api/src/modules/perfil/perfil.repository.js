'use strict';

/** Capa de datos del perfil (tabla usuario y municipio, migración 006). */
const SELECT_PERFIL = `
  SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.telefono, u.rol, u.municipio, u.vereda_direccion,
         u.verificado, u.estado, u.foto_url, u.fecha_registro, u.actualizado_en,
         ST_Y(u.coordenadas::geometry) AS lat, ST_X(u.coordenadas::geometry) AS lon,
         (u.coordenadas IS NOT NULL AND m.ubicacion IS NOT NULL AND ST_DWithin(u.coordenadas, m.ubicacion, 1)) AS en_cabecera
  FROM usuario u LEFT JOIN municipio m ON m.nombre = u.municipio`;

function createPerfilRepository({ pool }) {
  return {
    async buscar(id, db = pool) {
      const { rows } = await db.query(`${SELECT_PERFIL} WHERE u.id_usuario = $1`, [id]);
      return rows[0] || null;
    },

    /**
     * CU-09 paso 3: guarda solo los campos enviados y recalcula las coordenadas:
     * ubicación del teléfono si llegó; si cambió el municipio, la cabecera municipal.
     */
    async actualizar(db, id, c) {
      const sets = [];
      const params = [id];
      const poner = (columna, valor) => { params.push(valor); sets.push(`${columna} = $${params.length}`); };
      if (c.nombres !== undefined) poner('nombres', c.nombres);
      if (c.apellidos !== undefined) poner('apellidos', c.apellidos);
      if (c.correo !== undefined) poner('correo', c.correo);
      if (c.telefono !== undefined) poner('telefono', c.telefono);
      let posMunicipio = null;
      if (c.municipio !== undefined) { poner('municipio', c.municipio); posMunicipio = params.length; }
      if (c.veredaDireccion !== undefined) poner('vereda_direccion', c.veredaDireccion);
      if (c.ubicacion) {
        params.push(c.ubicacion.lon, c.ubicacion.lat);
        sets.push(`coordenadas = ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`);
      } else if (c.municipio !== undefined) {
        sets.push(`coordenadas = (SELECT ubicacion FROM municipio WHERE nombre = $${posMunicipio}::varchar)`);
      }
      await db.query(`UPDATE usuario SET ${sets.join(', ')} WHERE id_usuario = $1`, params);
    },

    async cambiarFoto(id, clave) {
      const { rows } = await pool.query(
        'UPDATE usuario u SET foto_url = $2 FROM usuario anterior WHERE u.id_usuario = $1 AND anterior.id_usuario = u.id_usuario RETURNING anterior.foto_url AS anterior',
        [id, clave],
      );
      return rows[0] ? rows[0].anterior : null;
    },
  };
}

module.exports = { createPerfilRepository, SELECT_PERFIL };
