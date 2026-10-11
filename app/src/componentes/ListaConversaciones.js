import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AvisoSinSenal } from './AvisoSinSenal';
import { Aviso } from './Aviso';
import { ESTADOS_PEDIDO } from './EstadoPedido';
import { fechaCorta } from './TarjetaPedido';
import { api } from '../api/cliente';
import { guardarMeta, leerMeta } from '../local/baseLocal';
import { useTiempoReal } from '../tiempoReal/TiempoRealContext';
import { useSesion } from '../sesion/SesionContext';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

/**
 * Bandeja "Mensajes" (CU-05): un chat por pedido, con el último mensaje y los no leídos.
 * Se actualiza en tiempo real; sin señal muestra la última copia guardada.
 */
export function ListaConversaciones({ rol }) {
  const router = useRouter();
  const { suscribir, versionPedidos } = useTiempoReal();
  const { usuario } = useSesion();
  const [conversaciones, setConversaciones] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.conversaciones();
      setConversaciones(r.conversaciones);
      setDesdeCache(false);
      setError(null);
      guardarMeta('conversaciones', JSON.stringify(r.conversaciones)).catch(() => {});
    } catch (err) {
      if (err.codigo === 'SIN_CONEXION') {
        const guardadas = await leerMeta('conversaciones').catch(() => null);
        setConversaciones(guardadas ? JSON.parse(guardadas) : []);
        setDesdeCache(true);
      } else {
        setError(mensajeDeError(err));
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionPedidos solo dispara la recarga
  }, [cargar, versionPedidos]));

  // Un mensaje nuevo sube la conversación y suma un no leído sin volver a pedir la lista.
  useEffect(() => suscribir((e) => {
    if (e.tipo !== 'mensaje') return;
    const propio = e.mensaje.idEmisor === usuario.id;
    if (!conversaciones || !conversaciones.some((x) => x.idPedido === e.mensaje.idPedido)) {
      cargar(); // conversación nueva: se pide la lista
      return;
    }
    setConversaciones((lista) => {
      const c = lista.find((x) => x.idPedido === e.mensaje.idPedido);
      if (!c) return lista;
      const actualizada = { ...c, ultimoMensaje: { contenido: e.mensaje.contenido, fecha: e.mensaje.fecha, propio }, sinLeer: c.sinLeer + (propio ? 0 : 1) };
      return [actualizada, ...lista.filter((x) => x.idPedido !== c.idPedido)];
    });
  }), [suscribir, cargar, conversaciones, usuario.id]);

  const base = rol === 'PRODUCTOR' ? '/productor' : '/consumidor';
  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={conversaciones || []}
      keyExtractor={(c) => c.idPedido}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} colors={[colores.primario]} />}
      ListHeaderComponent={(
        <>
          {desdeCache ? <AvisoSinSenal /> : null}
          {error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
        </>
      )}
      renderItem={({ item: c }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chat con ${c.contraparte}${c.sinLeer ? `, ${c.sinLeer} sin leer` : ''}${c.ultimoMensaje ? `. Último: ${c.ultimoMensaje.contenido}` : ''}`}
          onPress={() => router.push(`${base}/chat/${c.idPedido}`)}
          style={({ pressed }) => [styles.fila, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.cuerpo}>
            <View style={styles.encabezado}>
              <Text style={[styles.nombre, c.sinLeer ? styles.nombreNuevo : null]} numberOfLines={1}>{c.contraparte}</Text>
              {c.ultimoMensaje ? <Text style={styles.fecha}>{fechaCorta(c.ultimoMensaje.fecha)}</Text> : null}
            </View>
            <Text style={styles.ultimo} numberOfLines={1}>
              {c.ultimoMensaje ? `${c.ultimoMensaje.propio ? 'Usted: ' : ''}${c.ultimoMensaje.contenido}` : 'Sin mensajes todavía'}
            </Text>
            <Text style={styles.pedido}>{ESTADOS_PEDIDO[c.estadoPedido].icono} Pedido {ESTADOS_PEDIDO[c.estadoPedido].texto.toLowerCase()}{c.abierto ? '' : ' · solo lectura'}</Text>
          </View>
          {c.sinLeer ? <View style={styles.insignia}><Text style={styles.insigniaTexto}>{c.sinLeer}</Text></View> : null}
        </Pressable>
      )}
      ListEmptyComponent={conversaciones ? (
        <View style={styles.vacio} testID="conversaciones-vacio">
          <Text style={styles.vacioIcono} importantForAccessibility="no">💬</Text>
          <Text style={styles.vacioTexto}>No tiene conversaciones. El chat se abre desde cada pedido.</Text>
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderBottomWidth: 1, borderBottomColor: colores.superficie, paddingVertical: espacio.m },
  cuerpo: { flex: 1, minWidth: 0, gap: 2 },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s },
  nombre: { flex: 1, fontSize: texto.base, fontWeight: '700', color: colores.texto },
  nombreNuevo: { fontWeight: '900' },
  fecha: { fontSize: 12, color: colores.textoSecundario },
  ultimo: { fontSize: texto.pequeno, color: colores.texto },
  pedido: { fontSize: 12, color: colores.textoSecundario },
  insignia: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: colores.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  insigniaTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: texto.pequeno },
  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioIcono: { fontSize: 48 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', marginTop: espacio.s },
});
