/**
 * API simulada para las pruebas: responde según "MÉTODO /ruta".
 * Cada manejador recibe { cuerpo, cabeceras } y devuelve [status, json].
 */
export function apiFalsa(manejadores = {}) {
  const llamadas = [];
  global.fetch = jest.fn(async (url, opciones = {}) => {
    const ruta = url.replace(/^.*\/api\/v1/, '');
    const clave = `${opciones.method || 'GET'} ${ruta}`;
    const cuerpo = typeof opciones.body === 'string' ? JSON.parse(opciones.body) : leerFormulario(opciones.body);
    llamadas.push({ clave, cuerpo, cabeceras: opciones.headers || {} });
    const manejador = manejadores[clave]
      || (clave === 'GET /salud' ? () => [200, { estado: 'ok', baseDeDatos: { migracion: '001' } }] : null);
    if (!manejador) return respuesta(404, { error: { codigo: 'NO_ENCONTRADO', mensaje: clave } });
    const r = await manejador({ cuerpo, cabeceras: opciones.headers || {} });
    if (r === 'SIN_RED') throw new TypeError('Network request failed');
    return respuesta(r[0], r[1]);
  });
  return llamadas;
}

/** FormData → { campo: valor } (sirve con la implementación de React Native y con la de Node). */
function leerFormulario(fd) {
  if (!fd) return undefined;
  const partes = {};
  if (typeof fd.getParts === 'function') {
    for (const p of fd.getParts()) partes[p.fieldName] = p.string !== undefined ? p.string : p;
  } else {
    for (const [k, v] of fd.entries()) partes[k] = v;
  }
  return partes;
}

function respuesta(status, json) {
  return { ok: status >= 200 && status < 300, status, text: async () => (json === undefined ? '' : JSON.stringify(json)) };
}

export const usuarioRosa = {
  id: 'u-rosa', nombres: 'Rosa', apellidos: 'Peñaranda', correo: 'rosa@correo.co', telefono: '3105551234',
  rol: 'PRODUCTOR', municipio: 'Pamplonita', veredaDireccion: null, verificado: false,
};

export const usuarioAndres = { ...usuarioRosa, id: 'u-andres', nombres: 'Andrés', correo: 'andres@correo.co', rol: 'CONSUMIDOR', municipio: 'Cúcuta' };

const enUnaSemana = () => new Date(Date.now() + 7 * 864e5).toISOString();

export const sesionDe = (usuario) => ({ token: `jwt-${usuario.id}`, tipo: 'Bearer', expiraEn: enUnaSemana(), usuario });

/** Producto como lo devuelve la API (productoPublico). */
export function productoApi(extra = {}) {
  return {
    id: 'p-papa', nombre: 'Papa pastusa', descripcion: 'Cosecha de esta semana', categoria: 'TUBERCULOS',
    precio: 85000, unidad: 'bulto', stock: 20, estado: 'ACTIVA', municipio: 'Pamplonita', version: 1,
    fotoUrl: 'http://api/fotos/p.jpg', miniaturaUrl: 'http://api/fotos/p_min.jpg',
    fechaPublicacion: '2026-10-11T10:00:00Z', actualizadoEn: '2026-10-11T10:00:00Z',
    productor: { id: 'u-rosa', nombre: 'Rosa P.', verificado: false, calificacion: { promedio: null, total: 0 } },
    ...extra,
  };
}
