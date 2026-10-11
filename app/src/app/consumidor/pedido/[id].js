import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { Aviso } from '../../../componentes/Aviso';
import { DetallePedido } from '../../../componentes/DetallePedido';
import { BotonChat } from '../../../componentes/BotonChat';
import { CalificarPedido } from '../../../componentes/Calificacion';
import { useSincronizacion } from '../../../sync/SincronizacionContext';
import { useTiempoReal } from '../../../tiempoReal/TiempoRealContext';
import { api } from '../../../api/cliente';
import { guardarPedidos, pedidoLocal } from '../../../local/cache';
import { AvisoSinSenal } from '../../../componentes/AvisoSinSenal';
import { useConexion } from '../../../hooks/useConexion';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Comprobante y seguimiento del pedido (CU-04 paso 4, CU-15) y pago en línea (CU-22).
 * El resultado del pago lo decide el evento firmado que Wompi envía al servidor; al volver de la
 * página de pago la app solo consulta el estado (la redirección es informativa).
 */
export default function PedidoConsumidor() {
  const { id, nuevo } = useLocalSearchParams();
  const { enLinea } = useConexion();
  const [pedido, setPedido] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [calificacionEnCola, setCalificacionEnCola] = useState(null);
  const { operaciones, version: versionSync } = useSincronizacion();
  const { versionPedidos } = useTiempoReal();
  const [aviso, setAviso] = useState(nuevo ? { tipo: 'info', mensaje: '✓ Pedido confirmado. El productor ya recibió el aviso.' } : null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const ops = await operaciones().catch(() => []);
    setCalificacionEnCola(ops.find((o) => o.entidad === 'CALIFICACION' && o.idEntidad === id) || null);
    try {
      const r = await api.pedido(id);
      setPedido(r.pedido);
      setDesdeCache(false);
      guardarPedidos([r.pedido]).catch(() => {});
      return r.pedido;
    } catch (err) {
      const local = err.codigo === 'SIN_CONEXION' ? await pedidoLocal(id).catch(() => null) : null;
      if (local) {
        setPedido(local);
        setDesdeCache(true);
      } else {
        setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      }
      return null;
    }
  }, [id, operaciones]);

  // Se consulta al abrir y cada vez que se vuelve a la pantalla (p. ej. al regresar de la página de pago).
  // También cuando el productor cambia el estado (tiempo real) o termina una sincronización.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- las versiones solo disparan la recarga
  useFocusEffect(useCallback(() => { cargar(); }, [cargar, versionPedidos, versionSync]));

  async function pagar() {
    setOcupado(true);
    setAviso(null);
    try {
      const { urlCheckout } = await api.iniciarPago(id);
      await WebBrowser.openAuthSessionAsync(urlCheckout, 'agrotech://pago');
      setAviso({ tipo: 'info', mensaje: 'Verificando el pago con Wompi…' });
      let p = await cargar();
      for (let i = 0; i < 5 && p && p.estadoPago === 'PENDIENTE'; i += 1) {
        await esperar(2000);
        p = await cargar();
      }
      if (p && p.estadoPago === 'APROBADO') setAviso({ tipo: 'info', mensaje: '✓ Pago aprobado. El productor ya puede aceptar su pedido.' });
      else if (p && p.estadoPago === 'RECHAZADO') setAviso({ tipo: 'error', mensaje: 'El pago fue rechazado. Puede intentar de nuevo o pagar contra entrega.' });
      else setAviso({ tipo: 'sinSenal', mensaje: 'Todavía no hay respuesta del pago. Deslice hacia abajo en unos minutos para actualizar.' });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setOcupado(false);
    }
  }

  async function contraEntrega() {
    setOcupado(true);
    try {
      const r = await api.cambiarAContraEntrega(id);
      setPedido(r.pedido);
      setAviso({ tipo: 'info', mensaje: '✓ Listo: pagará al productor cuando reciba el pedido.' });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setOcupado(false);
    }
  }

  if (!pedido) {
    return <View style={styles.centro}>{aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;
  }

  const puedePagar = pedido.estado === 'PENDIENTE' && pedido.metodoPago === 'EN_LINEA' && ['PENDIENTE', 'RECHAZADO'].includes(pedido.estadoPago);

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido} refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}>
      {desdeCache ? <AvisoSinSenal detalle="El pago en línea necesita conexión." /> : null}
      {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-pedido" /> : null}
      {puedePagar ? (
        <View style={styles.pago}>
          <Text style={styles.pagoTitulo}>💳 Falta pagar este pedido</Text>
          <Text style={styles.pagoTexto}>Pagará en la página segura de Wompi con tarjeta, PSE, Nequi o Daviplata. AgroTech no ve los datos de su tarjeta.</Text>
          <BotonGrande titulo={ocupado ? 'Abriendo…' : pedido.estadoPago === 'RECHAZADO' ? 'Intentar el pago de nuevo' : 'Pagar en línea'} onPress={pagar} deshabilitado={ocupado || !enLinea} />
          {pedido.estadoPago === 'RECHAZADO' ? (
            <BotonGrande titulo="Mejor pago contra entrega" variante="secundario" onPress={contraEntrega} deshabilitado={ocupado || !enLinea} />
          ) : null}
        </View>
      ) : null}
      {pedido.estado === 'ENTREGADO' ? <CalificarPedido pedido={pedido} enCola={calificacionEnCola} onCalificado={cargar} /> : null}
      <BotonChat pedido={pedido} rol="CONSUMIDOR" contraparte={pedido.productor.nombre} />
      <DetallePedido pedido={pedido} contraparte={pedido.productor.nombre} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  pago: { borderWidth: 2, borderColor: colores.primario, borderRadius: 14, padding: espacio.m, marginBottom: espacio.m, backgroundColor: colores.primarioClaro },
  pagoTitulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  pagoTexto: { fontSize: texto.pequeno, color: colores.texto, marginVertical: espacio.xs },
});
