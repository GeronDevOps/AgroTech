// Red simulada con estado conmutable (modo avión): global.__red.desconectar() / conectar().
jest.mock('@react-native-community/netinfo', () => require('./jest/redSimulada'));

// Base local: SQLite real de Node en memoria con la API de expo-sqlite.
jest.mock('expo-sqlite', () => require('./jest/sqliteNode'));

// Sistema de archivos: las fotos de la cola se "copian" a documentos/cola/.
jest.mock('expo-file-system', () => {
  class Directory {
    constructor(...partes) { this.uri = partes.map((p) => (typeof p === 'string' ? p : p.uri)).join('/'); }
    create() {}
  }
  class File {
    constructor(...partes) { this.uri = partes.map((p) => (typeof p === 'string' ? p : p.uri)).join('/'); this.exists = true; }
    async copy() {}
    delete() { global.__archivosBorrados.push(this.uri); }
  }
  global.__archivosBorrados = [];
  return { Directory, File, Paths: { document: new Directory('file:///documentos'), cache: new Directory('file:///cache') } };
});

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

// UUID: el primero de cada prueba es fijo (id de la publicación); los siguientes, distintos (ids de la cola).
jest.mock('expo-crypto', () => {
  global.__uuids = 0;
  return {
    randomUUID: jest.fn(() => {
      global.__uuids += 1;
      return global.__uuids === 1 ? '11111111-1111-4111-8111-111111111111' : `22222222-2222-4222-8222-${String(global.__uuids).padStart(12, '0')}`;
    }),
  };
});

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

// Página de pago de Wompi simulada: el usuario vuelve a la app con la redirección.
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(async (url, retorno) => ({ type: 'success', url: `${retorno}?id=tx-1` })),
  maybeCompleteAuthSession: jest.fn(),
}));
