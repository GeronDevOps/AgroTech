import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { Aviso } from '../../componentes/Aviso';
import { AvisoSinSenal } from '../../componentes/AvisoSinSenal';
import { TarjetaProducto } from '../../componentes/TarjetaProducto';
import { api } from '../../api/cliente';
import { guardarProductos, misProductosLocal } from '../../local/cache';
import { useSesion } from '../../sesion/SesionContext';
import { useSincronizacion } from '../../sync/SincronizacionContext';
import { misProductosConCola } from '../../sync/superponer';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/**
 * "Mis productos" (CA-03, CA-04, CA-13): publicaciones propias con su estado; un toque abre la edición.
 * Lo hecho sin señal aparece arriba como "Pendiente por sincronizar" o "Con error" (CU-17).
 * Sin red se muestra la copia del teléfono con la fecha de la última sincronización.
 */
export default function MisProductos() {
  const router = useRouter();
  const { publicado, enCola } = useLocalSearchParams();
  const { usuario } = useSesion();
  const sync = useSincronizacion();
  const { operaciones, version: versionSync, sincronizar } = sync;
  const [productos, setProductos] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    let lista;
    let local = false;
    try {
      lista = (await api.misProductos()).productos;
      guardarProductos(lista).catch(() => {});
      setError(null);
    } catch (err) {
      if (err.codigo !== 'SIN_CONEXION') setError(mensajeDeError(err));
      lista = await misProductosLocal(usuario.id).catch(() => []);
      local = err.codigo === 'SIN_CONEXION';
    }
    const ops = await operaciones().catch(() => []);
    setProductos(misProductosConCola(lista, ops, usuario));
    setDesdeCache(local);
    setCargando(false);
  }, [usuario, operaciones]);

  // Se recarga al volver a la pantalla y cuando termina una sincronización.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionSync solo dispara la recarga
  useFocusEffect(useCallback(() => { cargar(); }, [cargar, versionSync]));

  const enCambio = productos ? productos.filter((p) => p.sync).length : 0;

  return (
    <View style={styles.pantalla}>
      <FlatList
        data={productos || []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => { sincronizar(); cargar(); }} colors={[colores.primario]} />}
        ListHeaderComponent={(
          <>
            {publicado ? <Aviso tipo="info" mensaje={`✓ "${publicado}" quedó publicado y ya aparece en el catálogo.`} testID="aviso-publicado" /> : null}
            {enCola ? (
              <Aviso tipo="sinSenal" mensaje={`"${enCola}" quedó guardado en el teléfono. Se publicará solo cuando vuelva la señal.`} testID="aviso-en-cola" />
            ) : null}
            {desdeCache ? <AvisoSinSenal /> : null}
            {error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
            {sync.conError ? (
              <Aviso mensaje={`${sync.conError === 1 ? 'Un cambio no se pudo publicar' : `${sync.conError} cambios no se pudieron publicar`}. Toque el producto marcado "Con error" para corregirlo o descartarlo.`} testID="aviso-con-error" />
            ) : null}
            {enCambio && !sync.conError ? <Text style={styles.nota}>Los cambios marcados ⏳ se envían solos al tener señal.</Text> : null}
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
  nota: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.s },
  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioIcono: { fontSize: 48 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, marginTop: espacio.s },
});
