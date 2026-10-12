import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { Aviso } from '../../../componentes/Aviso';
import { DetallePedido } from '../../../componentes/DetallePedido';
import { BotonChat } from '../../../componentes/BotonChat';
import { Estrellas } from '../../../componentes/Calificacion';
import { useTiempoReal } from '../../../tiempoReal/TiempoRealContext';
import { api } from '../../../api/cliente';
import { guardarPedidos, pedidoLocal } from '../../../local/cache';
import { AvisoSinSenal } from '../../../componentes/AvisoSinSenal';
import { useConexion } from '../../../hooks/useConexion';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

/** Siguiente paso permitido según el diagrama de estados del pedido (Entrega 3, Ilustración 7a). */
const SIGUIENTE = {
  ACEPTADO: { estado: 'EN_CAMINO', titulo: '🚚 Marcar en camino' },
  EN_CAMINO: { estado: 'ENTREGADO', titulo: '✅ Marcar entregado' },
};

/** CU-13 · Gestionar el pedido: aceptar o rechazar (con motivo) y avanzar el estado. Requiere red (A4). */
export default function PedidoProductor() {
  const { id } = useLocalSearchParams();
  const { enLinea } = useConexion();
  const [pedido, setPedido] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const { versionPedidos } = useTiempoReal();
  const [aviso, setAviso] = useState(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { pedido: p } = await api.pedido(id);
      setPedido(p);
      setDesdeCache(false);
      guardarPedidos([p]).catch(() => {});
    } catch (err) {
      const local = err.codigo === 'SIN_CONEXION' ? await pedidoLocal(id).catch(() => null) : null;
      if (local) {
        setPedido(local);
        setDesdeCache(true);
      } else {
        setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      }
    }
  }, [id]);
  // Se consulta al abrir y cada vez que se vuelve a la pantalla (p. ej. al regresar de la página de pago).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionPedidos (tiempo real) solo dispara la recarga
  useFocusEffect(useCallback(() => { cargar(); }, [cargar, versionPedidos]));

  async function cambiar(estado, extra = {}) {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await api.cambiarEstadoPedido(id, { estado, version: pedido.version, ...extra });
      setPedido(r.pedido);
      setRechazando(false);
      setAviso({ tipo: 'info', mensaje: `✓ Pedido ${estado === 'CANCELADO' ? 'rechazado; el inventario volvió a su publicación' : 'actualizado'}. El consumidor verá el cambio.` });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      if (err.codigo === 'CONFLICTO_VERSION') cargar();
    } finally {
      setOcupado(false);
    }
  }

  function rechazar() {
    if (motivo.trim().length < 3) return setErrorMotivo('Escriba el motivo para el consumidor.');
    setErrorMotivo(null);
    return cambiar('CANCELADO', { motivo: motivo.trim() });
  }

  if (!pedido) {
    return <View style={styles.centro}>{aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;
  }

  const esperaPago = pedido.metodoPago === 'EN_LINEA' && pedido.estadoPago !== 'APROBADO';
  const siguiente = SIGUIENTE[pedido.estado];
  const deshabilitado = ocupado || !enLinea;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido} refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}>
      {desdeCache ? <AvisoSinSenal detalle="Para cambiar el estado del pedido necesita conexión." /> : null}
      {!enLinea && !desdeCache ? <Aviso tipo="sinSenal" mensaje="Sin señal. Para cambiar el estado del pedido necesita conexión." /> : null}
      {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-pedido" /> : null}

      {pedido.estado === 'PENDIENTE' ? (
        <View style={styles.acciones}>
          <Text style={styles.accionesTitulo}>¿Puede atender este pedido?</Text>
          {esperaPago ? (
            <Aviso tipo="sinSenal" mensaje="El consumidor eligió pagar en línea y el pago aún no está aprobado. Podrá aceptarlo cuando se apruebe." testID="aviso-espera-pago" />
          ) : null}
          <BotonGrande titulo="✔ Aceptar pedido" onPress={() => cambiar('ACEPTADO')} deshabilitado={deshabilitado || esperaPago} />
          {rechazando ? (
            <View>
              <CampoTexto etiqueta="Motivo del rechazo" value={motivo} onChangeText={setMotivo} error={errorMotivo} placeholder="Ej.: no alcanzo a cosechar esa cantidad" />
              <BotonGrande titulo="Confirmar rechazo" variante="secundario" onPress={rechazar} deshabilitado={deshabilitado} />
            </View>
          ) : (
            <BotonGrande titulo="✖ Rechazar" variante="secundario" onPress={() => setRechazando(true)} deshabilitado={deshabilitado} />
          )}
        </View>
      ) : null}
      {siguiente ? <BotonGrande titulo={siguiente.titulo} onPress={() => cambiar(siguiente.estado)} deshabilitado={deshabilitado} /> : null}

      {pedido.calificacion ? (
        <View style={styles.calificacion} testID="calificacion-recibida">
          <Text style={styles.calificacionTitulo}>Calificación de {pedido.consumidor.nombre}</Text>
          <Estrellas promedio={pedido.calificacion.puntuacion} />
          {pedido.calificacion.comentario ? <Text style={styles.calificacionTexto}>“{pedido.calificacion.comentario}”</Text> : null}
        </View>
      ) : null}
      <BotonChat pedido={pedido} rol="PRODUCTOR" contraparte={pedido.consumidor.nombre} />
      <DetallePedido pedido={pedido} contraparte={pedido.consumidor.nombre} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  acciones: { borderWidth: 2, borderColor: '#d6b656', backgroundColor: '#FFF8E1', borderRadius: 14, padding: espacio.m, marginBottom: espacio.m },
  calificacion: { borderRadius: 14, padding: espacio.m, marginBottom: espacio.m, backgroundColor: '#FFF8E1' },
  calificacionTitulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  calificacionTexto: { fontSize: texto.base, fontStyle: 'italic', color: colores.texto },
  accionesTitulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto, marginBottom: espacio.xs },
});
