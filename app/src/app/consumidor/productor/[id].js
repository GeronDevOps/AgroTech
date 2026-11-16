import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BotonReportar } from '../../../componentes/BotonReportar';
import { Aviso } from '../../../componentes/Aviso';
import { Estrellas } from '../../../componentes/Calificacion';
import { api } from '../../../api/cliente';
import { fechaCorta } from '../../../componentes/TarjetaPedido';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

/** CU-06 paso 4 · Opiniones del productor: promedio y comentarios de compradores (nombre corto, RNF-05). */
export default function OpinionesProductor() {
  const { id } = useLocalSearchParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.opiniones(id).then(setDatos).catch((err) => setError(mensajeDeError(err)));
  }, [id]);

  if (!datos) {
    return <View style={styles.centro}>{error ? <Aviso tipo="sinSenal" mensaje={error} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;
  }
  const { productor, reputacion } = datos;
  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
      data={datos.calificaciones}
      keyExtractor={(c, i) => `${c.fecha}-${i}`}
      ListHeaderComponent={(
        <View style={styles.cabecera}>
          <Text style={styles.nombre} accessibilityRole="header">{productor.nombre}{productor.verificado ? ' ✓' : ''}</Text>
          <Text style={styles.municipio}>📍 {productor.municipio}</Text>
          {reputacion.total ? <Estrellas promedio={reputacion.promedio} total={reputacion.total} tamano={texto.grande} /> : null}
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.opinion}>
          <View style={styles.fila}>
            <Estrellas promedio={item.puntuacion} />
            <Text style={styles.fecha}>{fechaCorta(item.fecha).slice(0, 5)}</Text>
          </View>
          {item.comentario ? <Text style={styles.comentario}>{item.comentario}</Text> : null}
          {item.oculto ? <Text style={styles.autor}>(Comentario ocultado por la administración)</Text> : null}
          <Text style={styles.autor}>— {item.consumidor}</Text>
          {item.id && item.comentario ? <BotonReportar tipo="CALIFICACION" id={item.id} titulo={`Comentario de ${item.consumidor}`} etiqueta="Reportar comentario" /> : null}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.vacio} testID="sin-opiniones">Este productor aún no tiene calificaciones.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  cabecera: { marginBottom: espacio.m, gap: espacio.xs },
  nombre: { fontSize: texto.grande, fontWeight: '800', color: colores.texto },
  municipio: { fontSize: texto.base, color: colores.textoSecundario },
  opinion: { borderWidth: 1, borderColor: colores.borde, borderRadius: 12, padding: espacio.m, marginBottom: espacio.s, gap: 2 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fecha: { fontSize: texto.pequeno, color: colores.textoSecundario },
  comentario: { fontSize: texto.base, color: colores.texto },
  autor: { fontSize: texto.pequeno, color: colores.textoSecundario },
  vacio: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', marginTop: espacio.l },
});
