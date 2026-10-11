/**
 * API simulada para las pruebas: responde según "MÉTODO /ruta".
 * Cada manejador recibe { cuerpo, cabeceras } y devuelve [status, json].
 */
export function apiFalsa(manejadores = {}) {
  const llamadas = [];
  global.fetch = jest.fn(async (url, opciones = {}) => {
    const ruta = url.replace(/^.*\/api\/v1/, '');
    const clave = `${opciones.method || 'GET'} ${ruta}`;
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined;
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
