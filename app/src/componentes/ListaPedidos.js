import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Aviso } from './Aviso';
import { AvisoSinSenal } from './AvisoSinSenal';
import { guardarPedidos, pedidosLocal } from '../local/cache';
import { useTiempoReal } from '../tiempoReal/TiempoRealContext';
import { Opciones } from './Opciones';
import { TarjetaPedido } from './TarjetaPedido';
import { api } from '../api/cliente';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const FILTROS = [{ valor: 'activos', texto: 'Activos' }, { valor: 'todos', texto: 'Todos' }];

/**
 * Lista de pedidos compartida por ambos roles (la API filtra según el rol del token).
 * Se recarga al volver a la pantalla y al deslizar hacia abajo.
 */
export function ListaPedidos({ contraparteDe, onAbrir, encabezado, vacio }) {
  const [filtro, setFiltro] = useState('activos');
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const { versionPedidos } = useTiempoReal();
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (f) => {
    setCargando(true);
    try {
      const r = await api.pedidos(f);
      setPedidos(r.pedidos);
      guardarPedidos(r.pedidos).catch(() => {});
      setError(null);
      setDesdeCache(false);
    } catch (err) {
      // CU-15 / CU-17: sin señal se muestran los pedidos guardados en el teléfono.
      if (err.codigo === 'SIN_CONEXION') {
        setPedidos(await pedidosLocal({ soloActivos: f === 'activos' }).catch(() => []));
        setDesdeCache(true);
        setError(null);
      } else {
        setError(mensajeDeError(err));
      }
    } finally {
      setCargando(false);
    }
  }, []);

  // Se recarga sola cuando llega un pedido nuevo o cambia uno (tiempo real, CA-06 y CA-08).
  useFocusEffect(useCallback(() => {
    cargar(filtro);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionPedidos solo dispara la recarga
  }, [cargar, filtro, versionPedidos]));

  return (
    <FlatList
      style={styles.pantalla}
      data={pedidos || []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.lista}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => cargar(filtro)} colors={[colores.primario]} />}
      ListHeaderComponent={(
        <>
          {encabezado}
          {desdeCache ? <AvisoSinSenal /> : null}
          {error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
          <Opciones opciones={FILTROS} valor={filtro} onCambiar={setFiltro} />
        </>
      )}
      renderItem={({ item }) => <TarjetaPedido pedido={item} contraparte={contraparteDe(item)} onPress={() => onAbrir(item)} />}
      ListEmptyComponent={pedidos ? (
        <View style={styles.vacio} testID="pedidos-vacio">
          <Text style={styles.vacioIcono} importantForAccessibility="no">📦</Text>
          <Text style={styles.vacioTexto}>{filtro === 'activos' ? vacio : 'Todavía no hay pedidos.'}</Text>
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m },
  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioIcono: { fontSize: 48 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, marginTop: espacio.s, textAlign: 'center' },
});
