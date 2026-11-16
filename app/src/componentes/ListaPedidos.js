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
import { BotonGrande } from './BotonGrande';
import { PERIODOS, haceDias } from '../datos/fase2';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const FILTROS = [{ valor: 'activos', texto: 'Activos' }, { valor: 'finalizados', texto: 'Finalizados' }, { valor: 'todos', texto: 'Todos' }];
const OPCIONES_PERIODO = PERIODOS.map((p) => ({ valor: p.valor === null ? 'siempre' : String(p.valor), texto: p.texto }));

/**
 * Lista de pedidos compartida por ambos roles (la API filtra según el rol del token).
 * RF-15 · CU-15: del más reciente al más antiguo, separando activos y finalizados, con filtro por fechas (paso 2).
 * Sin pedidos ofrece ir al catálogo (A1); sin señal muestra los guardados en el teléfono (A2).
 * Se recarga al volver a la pantalla y al deslizar hacia abajo.
 */
export function ListaPedidos({ contraparteDe, onAbrir, encabezado, vacio, accionVacio }) {
  const [filtro, setFiltro] = useState('activos');
  const [periodo, setPeriodo] = useState('siempre');
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const { versionPedidos } = useTiempoReal();
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (f, p) => {
    setCargando(true);
    const desde = p && p !== 'siempre' ? haceDias(Number(p)) : undefined;
    try {
      const r = await api.pedidos(desde ? { estado: f, desde } : f);
      setPedidos(r.pedidos);
      guardarPedidos(r.pedidos).catch(() => {});
      setError(null);
      setDesdeCache(false);
    } catch (err) {
      // CU-15 / CU-17: sin señal se muestran los pedidos guardados en el teléfono.
      if (err.codigo === 'SIN_CONEXION') {
        setPedidos(await pedidosLocal({ grupo: f, desde }).catch(() => []));
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
    cargar(filtro, periodo);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionPedidos solo dispara la recarga
  }, [cargar, filtro, periodo, versionPedidos]));

  return (
    <FlatList
      style={styles.pantalla}
      data={pedidos || []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.lista}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => cargar(filtro, periodo)} colors={[colores.primario]} />}
      ListHeaderComponent={(
        <>
          {encabezado}
          {desdeCache ? <AvisoSinSenal /> : null}
          {error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
          <Opciones opciones={FILTROS} valor={filtro} onCambiar={setFiltro} />
          <Opciones opciones={OPCIONES_PERIODO} valor={periodo} onCambiar={setPeriodo} testID="filtro-periodo" />
        </>
      )}
      renderItem={({ item }) => <TarjetaPedido pedido={item} contraparte={contraparteDe(item)} onPress={() => onAbrir(item)} />}
      ListEmptyComponent={pedidos ? (
        <View style={styles.vacio} testID="pedidos-vacio">
          <Text style={styles.vacioIcono} importantForAccessibility="no">📦</Text>
          <Text style={styles.vacioTexto}>{periodo !== 'siempre' ? 'No hay pedidos en ese periodo.' : filtro === 'activos' ? vacio : filtro === 'finalizados' ? 'Aún no hay pedidos entregados o cancelados.' : 'Todavía no hay pedidos.'}</Text>
          {accionVacio && filtro !== 'finalizados' ? <BotonGrande titulo={accionVacio.titulo} onPress={accionVacio.onPress} /> : null}
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
