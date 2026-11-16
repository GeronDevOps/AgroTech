'use strict';

// Correcciones de "error de conexión" en desarrollo: CORS para la red local y migraciones clonadas en Windows.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { cors, ORIGEN_LOCAL } = require('../../src/middleware/cors');
const { listMigrations } = require('../../src/db/migrate');

function ejecutar(mw, origen, metodo = 'GET') {
  const cabeceras = {};
  let estado = null;
  let siguio = false;
  const res = { set: (h) => Object.assign(cabeceras, h), sendStatus: (s) => { estado = s; } };
  mw({ headers: { origin: origen }, method: metodo }, res, () => { siguio = true; });
  return { cabeceras, estado, siguio };
}

describe('CORS de desarrollo', () => {
  test.each([
    'http://localhost:8081', 'http://127.0.0.1:8081', 'http://192.168.1.31:8081', 'http://10.0.0.5:19006', 'http://172.20.10.2:8081',
  ])('con red local permite %s', (origen) => {
    expect(ORIGEN_LOCAL.test(origen)).toBe(true);
    expect(ejecutar(cors([], { redLocal: true }), origen).cabeceras['Access-Control-Allow-Origin']).toBe(origen);
  });

  test.each(['https://agrotech.evil.com', 'http://192.168.1.31.evil.com', 'http://172.32.0.1:8081', 'http://8.8.8.8'])('rechaza %s', (origen) => {
    expect(ejecutar(cors([], { redLocal: true }), origen).cabeceras).toEqual({});
  });

  test('sin red local (producción) solo la lista explícita', () => {
    expect(ejecutar(cors(['https://panel.agrotech.co']), 'http://192.168.1.31:8081').cabeceras).toEqual({});
    expect(ejecutar(cors(['https://panel.agrotech.co']), 'https://panel.agrotech.co').cabeceras['Access-Control-Allow-Origin']).toBe('https://panel.agrotech.co');
  });

  test('responde 204 a la verificación previa (OPTIONS)', () => {
    expect(ejecutar(cors([], { redLocal: true }), 'http://192.168.1.31:8081', 'OPTIONS').estado).toBe(204);
  });
});

describe('Checksum de migraciones', () => {
  test('el mismo archivo con CRLF (clonado en Windows) se reconoce como igual', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    fs.writeFileSync(path.join(dir, '001_prueba.sql'), 'CREATE TABLE a (id INT);\r\nCREATE TABLE b (id INT);\r\n');
    const [m] = await listMigrations(dir);
    const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
    expect(m.equivalentes).toEqual(expect.arrayContaining([
      sha('CREATE TABLE a (id INT);\nCREATE TABLE b (id INT);\n'),
      sha('CREATE TABLE a (id INT);\r\nCREATE TABLE b (id INT);\r\n'),
    ]));
    expect(m.equivalentes).not.toContain(sha('CREATE TABLE a (id INT);\n'));
  });
});
