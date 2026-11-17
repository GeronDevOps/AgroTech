import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Aviso } from './Aviso';
import { BotonGrande } from './BotonGrande';
import { api } from '../api/cliente';
import { useBase } from '../hooks/useBase';
import { useTiempoReal } from '../tiempoReal/TiempoRealContext';
import { fechaCorta } from './TarjetaPedido';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

/**
 * CU-16 A1/A3 · Bandeja interna de avisos (RF-16): lo que llegó por push o mientras no había permiso.
 * Tocar un aviso de pedido abre el pedido o el chat (paso 3). Al entrar se marcan todos como leídos.
 */
export function PantallaAvisos() {
  const router = useRouter();
  const base = useBase();
  const { versionNotificaciones } = useTiempoReal();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.notificaciones();
      setLista(r.notificaciones);
      setError(null);
      if (r.sinLeer) api.marcarNotificacionesLeidas().catch(() => {});
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionNotificaciones solo dispara la recarga
  useFocusEffect(useCallback(() => { cargar(); }, [cargar, versionNotificaciones]));

  const abrir = (n) => {
    if (n.datos && n.datos.idPedido) router.push(`${base}/${n.datos.abrir === 'CHAT' ? 'chat' : 'pedido'}/${n.datos.idPedido}`);
    else if (n.datos && n.datos.idReporte) router.push(`${base}/reportes`);
  };

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={lista || []}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} colors={[colores.primario]} />}
      ListHeaderComponent={error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.leida ? '' : 'Nuevo. '}${item.titulo}. ${item.cuerpo}`}
          onPress={() => abrir(item)}
          style={({ pressed }) => [styles.tarjeta, !item.leida && styles.noLeida, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.fila}>
            <Text style={styles.titulo}>{item.titulo}</Text>
            <Text style={styles.fecha}>{fechaCorta(item.fecha)}</Text>
          </View>
          <Text style={styles.cuerpo}>{item.cuerpo}</Text>
        </Pressable>
      )}
      ListEmptyComponent={lista ? (
        <View style={styles.vacio} testID="avisos-vacio">
          <Text style={styles.vacioIcono} importantForAccessibility="no">🔔</Text>
          <Text style={styles.vacioTexto}>No tiene avisos todavía.</Text>
          <BotonGrande titulo="Volver" variante="secundario" onPress={() => router.back()} />
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m },
  tarjeta: { borderWidth: 1, borderColor: colores.borde, borderRadius: 12, padding: espacio.m, marginBottom: espacio.s },
  noLeida: { borderWidth: 2, borderColor: colores.primario, backgroundColor: colores.primarioClaro },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s },
  titulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto, flex: 1 },
  fecha: { fontSize: 12, color: colores.textoSecundario },
  cuerpo: { fontSize: texto.pequeno, color: colores.texto, marginTop: espacio.xs },
  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioIcono: { fontSize: 48 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, marginVertical: espacio.s },
});
