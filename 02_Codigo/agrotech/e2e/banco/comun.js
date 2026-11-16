/** Datos y ayudas comunes de los casos de API del banco. */
const crypto = require('node:crypto');
const api = require('../soporte/api');

const marca = () => crypto.randomBytes(3).toString('hex');
const tel = () => `3${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;
const correoNuevo = () => `bp.${Date.now().toString(36)}${marca()}@agrotech.test`;

/** Cuerpo de registro válido (CU-01) con correo y celular únicos; `cambios` sobrescribe campos. */
const registro = (cambios = {}) => ({
  nombres: 'Banco', apellidos: 'Prueba', correo: correoNuevo(), telefono: tel(), contrasena: api.CONTRASENA,
  rol: 'CONSUMIDOR', municipio: 'Pamplona', aceptaTratamientoDatos: true, ...cambios,
});

const primerPedido = async (r) => {
  const b = await api.json(r);
  if (r.status() !== 201) throw new Error(`pedido: ${r.status()} ${JSON.stringify(b)}`);
  return b.pedidos[0];
};

async function esperarHasta(condicion, ms = 6000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await condicion()) return; await new Promise((r) => setTimeout(r, 60)); }
  throw new Error('Tiempo agotado esperando la condición');
}

module.exports = { ...api, marca, tel, correoNuevo, registro, primerPedido, esperarHasta };
