import { createContext, useContext, useMemo, useState } from 'react';

/**
 * Estado de la sesión y rol del usuario.
 * Fase 1: sesión de demostración en memoria para validar la navegación por rol.
 * Fase 2 (AGRO-5): inicio de sesión real con JWT guardado en el almacén seguro del teléfono.
 */
export const ROLES = Object.freeze({ PRODUCTOR: 'PRODUCTOR', CONSUMIDOR: 'CONSUMIDOR' });

const SesionContext = createContext(null);

export function SesionProvider({ children, sesionInicial = null }) {
  const [usuario, setUsuario] = useState(sesionInicial);

  const valor = useMemo(() => ({
    usuario,
    rol: usuario ? usuario.rol : null,
    iniciarDemo(rol) {
      if (!Object.values(ROLES).includes(rol)) throw new Error(`Rol desconocido: ${rol}`);
      setUsuario({ nombres: rol === ROLES.PRODUCTOR ? 'Rosa' : 'Andrés', rol });
    },
    cerrarSesion() { setUsuario(null); },
  }), [usuario]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>.');
  return ctx;
}
