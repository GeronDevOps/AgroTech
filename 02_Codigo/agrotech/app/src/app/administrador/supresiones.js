import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Aviso } from '../../componentes/Aviso';
import { api } from '../../api/cliente';
import { fechaCorta } from '../../componentes/TarjetaPedido';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/** Apoyo a CU-20: solicitudes de supresión y su plazo legal (15 días hábiles). Los datos del titular ya no se muestran. */
export default function SupresionesAdmin() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => {
    api.admin.supresiones().then((r) => setLista(r.solicitudes)).catch((err) => setError(mensajeDeError(err)));
  }, []));
  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={lista || []}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <Aviso mensaje={error} /> : null}
      renderItem={({ item }) => (
        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>{item.estado} · {item.rol === 'PRODUCTOR' ? 'Productor' : 'Consumidor'}</Text>
          <Text style={styles.detalle}>Solicitada el {fechaCorta(item.fechaSolicitud)} · fecha límite {item.fechaLimite}</Text>
          {item.observacion ? <Text style={styles.detalle}>{item.observacion}</Text> : null}
        </View>
      )}
      ListEmptyComponent={lista ? <Text style={styles.vacio}>No hay solicitudes.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m, maxWidth: 960, width: '100%', alignSelf: 'center' },
  tarjeta: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginBottom: espacio.s },
  titulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  detalle: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: 2 },
  vacio: { textAlign: 'center', fontSize: texto.base, color: colores.textoSecundario, padding: espacio.xl },
});
