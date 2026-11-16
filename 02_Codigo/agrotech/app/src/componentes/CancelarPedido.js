import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BotonGrande } from './BotonGrande';
import { CampoTexto } from './CampoTexto';
import { Opciones } from './Opciones';
import { Aviso } from './Aviso';
import { api } from '../api/cliente';
import { MOTIVOS_CANCELACION } from '../datos/fase2';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const OTRO = '__otro__';

/**
 * CU-14 · Cancelar un pedido no entregado (RF-14). Elige un motivo (o lo escribe) y confirma.
 * El servidor restituye el inventario y avisa a la contraparte; el chat queda en solo lectura.
 * Exige conexión (CU-17 A3: cambiar el estado de un pedido requiere red).
 */
export function CancelarPedido({ pedido, rol, enLinea, onCancelado }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const [otro, setOtro] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  if (!pedido.acciones || !pedido.acciones.includes('CANCELAR')) return null;

  const opciones = [...MOTIVOS_CANCELACION[rol].map((m) => ({ valor: m, texto: m })), { valor: OTRO, texto: 'Otro motivo' }];

  async function confirmar() {
    const texto = motivo === OTRO ? otro.trim() : motivo;
    if (!texto || texto.length < 3) { setError('Elija o escriba el motivo de la cancelación.'); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await api.cancelarPedido(pedido.id, texto, pedido.version);
      setAbierto(false);
      onCancelado(r);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return <BotonGrande titulo="Cancelar pedido" variante="secundario" onPress={() => setAbierto(true)} deshabilitado={!enLinea} />;
  }
  return (
    <View style={styles.caja} testID="cancelar-pedido">
      <Text style={styles.titulo}>¿Por qué cancela el pedido?</Text>
      <Text style={styles.ayuda}>Se devolverá la cantidad al inventario y se avisará a la otra parte.{pedido.estadoPago === 'APROBADO' ? ' El reembolso del pago en línea lo gestiona la asociación.' : ''}</Text>
      {error ? <Aviso mensaje={error} /> : null}
      <Opciones opciones={opciones} valor={motivo} onCambiar={setMotivo} />
      {motivo === OTRO ? <CampoTexto etiqueta="Escriba el motivo" value={otro} onChangeText={setOtro} maxLength={130} /> : null}
      <BotonGrande titulo={enviando ? 'Cancelando…' : 'Sí, cancelar el pedido'} onPress={confirmar} deshabilitado={enviando || !enLinea} />
      <BotonGrande titulo="No, volver" variante="secundario" onPress={() => setAbierto(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { borderWidth: 2, borderColor: colores.error, borderRadius: 14, padding: espacio.m, marginBottom: espacio.m },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginVertical: espacio.xs },
});
