// Simulación del módulo nativo de red para las pruebas (no existe fuera del teléfono).
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
