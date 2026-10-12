'use strict';

const { autenticar, autorizar } = require('../../src/middleware/autenticacion');
const { createTokens } = require('../../src/modules/auth/seguridad');

const tokens = createTokens({ secreto: 'x'.repeat(32), expiraEn: '1h' });

function ejecutar(mw, req) {
  return new Promise((resolve) => mw(req, {}, (err) => resolve({ err, req })));
}

const reqCon = (cabecera) => ({ get: (n) => (n === 'authorization' ? cabecera : undefined) });

describe('middleware autenticar / autorizar', () => {
  test('acepta un Bearer válido y deja el usuario en req', async () => {
    const { token } = tokens.firmar({ id_usuario: 'u1', rol: 'CONSUMIDOR' });
    const { err, req } = await ejecutar(autenticar(tokens), reqCon(`Bearer ${token}`));
    expect(err).toBeUndefined();
    expect(req.usuario).toEqual({ id: 'u1', rol: 'CONSUMIDOR' });
  });

  test.each([undefined, 'Basic abc', 'Bearer'])('rechaza la cabecera %p', async (cabecera) => {
    const { err } = await ejecutar(autenticar(tokens), reqCon(cabecera));
    expect(err).toMatchObject({ status: 401, codigo: 'NO_AUTENTICADO' });
  });

  test('autorizar devuelve 403 al rol equivocado', async () => {
    const mw = autorizar('PRODUCTOR');
    expect((await ejecutar(mw, { usuario: { rol: 'CONSUMIDOR' } })).err).toMatchObject({ status: 403 });
    expect((await ejecutar(mw, { usuario: { rol: 'PRODUCTOR' } })).err).toBeUndefined();
  });
});
