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

// UUID fijo para comprobar la idempotencia de la publicación.
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111') }));

// Cámara/galería y compresión simuladas: devuelven una foto ya comprimida.
jest.mock('expo-image-picker', () => {
  const foto = { canceled: false, assets: [{ uri: 'file:///original.jpg', width: 3000, height: 2250 }] };
  return {
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
    launchCameraAsync: jest.fn(async () => foto),
    launchImageLibraryAsync: jest.fn(async () => foto),
  };
});

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: ({ width }) => ({
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: `file:///comprimida-${width}.jpg`, width, height: Math.round(width * 0.75) }),
        }),
      }),
    })),
  },
}));
