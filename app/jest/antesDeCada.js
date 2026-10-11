import { reiniciarBaseLocalParaPruebas } from '../src/local/baseLocal';

// Cada prueba empieza con base local vacía, red disponible y la secuencia de UUID desde el principio.
beforeEach(() => {
  reiniciarBaseLocalParaPruebas();
  global.__red?.reiniciar(); // el simulador de red se crea al primer uso
  global.__uuids = 0;
  global.__archivosBorrados = [];
});
