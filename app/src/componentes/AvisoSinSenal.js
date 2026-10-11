import { Aviso } from './Aviso';
import { useSincronizacion } from '../sync/SincronizacionContext';
import { textoSincronizacion } from '../utilidades/formato';

/** CU-17 paso 1: aviso de modo sin conexión con la fecha de la última sincronización. */
export function AvisoSinSenal({ detalle }) {
  const { ultima } = useSincronizacion();
  return (
    <Aviso
      tipo="sinSenal"
      testID="aviso-sin-senal"
      mensaje={`Sin señal. Muestra lo guardado en el teléfono (sincronizado ${textoSincronizacion(ultima)}).${detalle ? ` ${detalle}` : ''}`}
    />
  );
}
