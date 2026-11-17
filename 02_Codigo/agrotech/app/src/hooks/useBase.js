import { useSesion } from '../sesion/SesionContext';

/** Ruta base del rol actual: '/productor', '/consumidor' o '/administrador'. */
export function useBase() {
  const { rol } = useSesion();
  if (rol === 'PRODUCTOR') return '/productor';
  if (rol === 'ADMINISTRADOR') return '/administrador';
  return '/consumidor';
}
