import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Aviso } from './Aviso';
import { api } from '../api/cliente';
import { fechaCorta } from './TarjetaPedido';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const ESTADO = { PENDIENTE: '⏳ Pendiente', EN_REVISION: '🔎 En revisión', RESUELTO: '✅ Atendido', DESESTIMADO: '— Desestimado' };
const QUE = { PRODUCTO: 'Publicación', CALIFICACION: 'Comentario', PEDIDO: 'Pedido' };

/** CU-19 paso 4: el usuario ve el estado y el resultado de sus reportes. */
export function PantallaMisReportes() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => {
    api.misReportes().then((r) => { setLista(r.reportes); setError(null); }).catch((err) => setError(mensajeDeError(err)));
  }, []));
  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={lista || []}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
      renderItem={({ item }) => (
        <View style={styles.tarjeta} accessible accessibilityLabel={`${QUE[item.tipoContenido]}: ${item.motivoTexto}. ${ESTADO[item.estado]}`}>
          <Text style={styles.titulo}>{QUE[item.tipoContenido]} · {item.motivoTexto}</Text>
          <Text style={styles.estado}>{ESTADO[item.estado]} · {fechaCorta(item.fecha)}</Text>
          {item.resolucion ? <Text style={styles.resolucion}>Respuesta: {item.resolucion}</Text> : null}
        </View>
      )}
      ListEmptyComponent={lista ? <Text style={styles.vacio}>No ha hecho reportes.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m },
  tarjeta: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginBottom: espacio.s },
  titulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  estado: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: 2 },
  resolucion: { fontSize: texto.pequeno, color: colores.texto, marginTop: espacio.xs },
  vacio: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', padding: espacio.xl },
});
