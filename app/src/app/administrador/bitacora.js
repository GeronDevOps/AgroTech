import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Aviso } from '../../componentes/Aviso';
import { api } from '../../api/cliente';
import { fechaCorta } from '../../componentes/TarjetaPedido';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/** Bitácora de auditoría (requisito de información "Bitácora de auditoría"): últimas 100 acciones. */
export default function BitacoraAdmin() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => {
    api.admin.bitacora(100).then((r) => setLista(r.registros)).catch((err) => setError(mensajeDeError(err)));
  }, []));
  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={lista || []}
      keyExtractor={(b, i) => `${b.fecha}-${i}`}
      ListHeaderComponent={error ? <Aviso mensaje={error} /> : null}
      renderItem={({ item }) => (
        <View style={styles.fila} accessible accessibilityLabel={`${item.accion}, ${item.resultado}, ${item.usuario || 'sistema'}`}>
          <Text style={styles.fecha}>{fechaCorta(item.fecha)}</Text>
          <Text style={styles.accion}>{item.accion} · {item.resultado}</Text>
          <Text style={styles.quien}>{item.usuario ? `${item.usuario} (${(item.rol || '').toLowerCase()})` : 'Sistema'} · {item.entidad}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m, maxWidth: 960, width: '100%', alignSelf: 'center' },
  fila: { borderBottomWidth: 1, borderBottomColor: colores.superficie, paddingVertical: espacio.s },
  fecha: { fontSize: 12, color: colores.textoSecundario },
  accion: { fontSize: texto.pequeno, fontWeight: '700', color: colores.texto },
  quien: { fontSize: 12, color: colores.textoSecundario },
});
