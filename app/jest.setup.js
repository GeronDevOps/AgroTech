// Simulación del módulo nativo de red para las pruebas (no existe fuera del teléfono).
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// Almacén seguro en memoria; las pruebas lo leen en global.__almacenSeguro.
jest.mock('expo-secure-store', () => {
  const datos = new Map();
  global.__almacenSeguro = datos;
  return {
    getItemAsync: jest.fn(async (k) => (datos.has(k) ? datos.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => { datos.set(k, v); }),
    deleteItemAsync: jest.fn(async (k) => { datos.delete(k); }),
  };
});
