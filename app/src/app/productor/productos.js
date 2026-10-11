import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { Aviso } from '../../componentes/Aviso';
import { TarjetaProducto } from '../../componentes/TarjetaProducto';
import { api } from '../../api/cliente';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/** "Mis productos" (CA-03, CA-13): publicaciones propias con su estado; un toque abre la edición. */
export default function MisProductos() {
  const router = useRouter();
  const { publicado } = useLocalSearchParams();
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.misProductos();
      setProductos(r.productos);
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  // Se recarga cada vez que la pantalla vuelve a verse (después de publicar o editar).
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  return (
    <View style={styles.pantalla}>
      <FlatList
        data={productos || []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} colors={[colores.primario]} />}
        ListHeaderComponent={(
          <>
            {publicado ? <Aviso tipo="info" mensaje={`✓ "${publicado}" quedó publicado y ya aparece en el catálogo.`} testID="aviso-publicado" /> : null}
            {error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
          </>
        )}
        renderItem={({ item }) => (
          <TarjetaProducto producto={item} compacta mostrarEstado onPress={() => router.push(`/productor/editar/${item.id}`)} />
        )}
        ListEmptyComponent={productos ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioIcono} importantForAccessibility="no">🧺</Text>
            <Text style={styles.vacioTexto}>Aún no tiene productos publicados.</Text>
          </View>
        ) : null}
        ListFooterComponent={<BotonGrande titulo="＋ Publicar producto" onPress={() => router.push('/productor/publicar')} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m },
  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioIcono: { fontSize: 48 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, marginTop: espacio.s },
});
