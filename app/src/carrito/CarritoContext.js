import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

/**
 * Carrito del consumidor (clase Carrito «solo en la app», Entrega 3).
 * - Guarda una copia del producto (precio y stock conocidos) para validar sin red (CU-04 paso 1).
 * - agruparPorProductor(): un pedido por productor al confirmar (CU-04 A3).
 * - La clave de idempotencia se crea una vez por carrito y se conserva hasta que el pedido se confirma:
 *   si se pierde la respuesta, el reintento envía la misma clave y no duplica el pedido (RNF-10).
 * La persistencia en SQLite llega con el modo sin conexión (AGRO-10).
 */
const CarritoContext = createContext(null);

export function CarritoProvider({ children }) {
  const [lineas, setLineas] = useState({}); // idProducto → { producto, cantidad }
  const clave = useRef(null);

  const tocar = () => { clave.current = null; }; // cualquier cambio del carrito exige una clave nueva

  const agregar = useCallback((producto, cantidad) => {
    tocar();
    setLineas((l) => {
      const actual = l[producto.id] ? l[producto.id].cantidad : 0;
      const nueva = Math.min(producto.stock, Math.round((actual + cantidad) * 100) / 100);
      return { ...l, [producto.id]: { producto, cantidad: nueva } };
    });
  }, []);

  const cambiarCantidad = useCallback((idProducto, cantidad) => {
    tocar();
    setLineas((l) => {
      if (!l[idProducto]) return l;
      if (!(cantidad > 0)) {
        const { [idProducto]: _fuera, ...resto } = l;
        return resto;
      }
      return { ...l, [idProducto]: { ...l[idProducto], cantidad: Math.min(cantidad, l[idProducto].producto.stock) } };
    });
  }, []);

  /** Tras un 409 de stock: ajusta lo que el servidor dice que hay disponible. */
  const ajustarDisponibles = useCallback((faltantes) => {
    tocar();
    setLineas((l) => {
      const copia = { ...l };
      for (const f of faltantes) {
        if (!copia[f.idProducto]) continue;
        if (f.disponible > 0) {
          copia[f.idProducto] = { producto: { ...copia[f.idProducto].producto, stock: f.disponible }, cantidad: Math.min(copia[f.idProducto].cantidad, f.disponible) };
        } else {
          delete copia[f.idProducto];
        }
      }
      return copia;
    });
  }, []);

  const vaciar = useCallback(() => { tocar(); setLineas({}); }, []);

  const claveIdempotencia = useCallback(() => {
    if (!clave.current) clave.current = Crypto.randomUUID();
    return clave.current;
  }, []);

  const valor = useMemo(() => {
    const lista = Object.values(lineas);
    const grupos = new Map();
    for (const l of lista) {
      const id = l.producto.productor.id;
      if (!grupos.has(id)) grupos.set(id, { productor: l.producto.productor, lineas: [], subtotal: 0 });
      const g = grupos.get(id);
      g.lineas.push(l);
      g.subtotal += l.cantidad * l.producto.precio;
    }
    return {
      lineas: lista,
      grupos: [...grupos.values()],
      cantidadProductos: lista.length,
      total: lista.reduce((s, l) => s + l.cantidad * l.producto.precio, 0),
      cantidadDe: (id) => (lineas[id] ? lineas[id].cantidad : 0),
      agregar, cambiarCantidad, ajustarDisponibles, vaciar, claveIdempotencia,
    };
  }, [lineas, agregar, cambiarCantidad, ajustarDisponibles, vaciar, claveIdempotencia]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>.');
  return ctx;
}
