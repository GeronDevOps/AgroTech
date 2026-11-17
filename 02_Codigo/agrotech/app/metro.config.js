// Configuración de Metro (empaquetador de Expo).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite en la vista web usa SQLite compilado a WebAssembly (solo para revisar pantallas en desarrollo).
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer (requerido por expo-sqlite web) exige aislamiento de origen en el servidor de desarrollo.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
