import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Opciones } from '../../componentes/Opciones';
import { Aviso } from '../../componentes/Aviso';
import { api } from '../../api/cliente';
import { fechaCorta } from '../../componentes/TarjetaPedido';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto, toque } from '../../tema/tema';

const FILTROS = [
  { valor: 'abiertos', texto: 'Por revisar' }, { valor: 'RESUELTO', texto: 'Atendidos' },
  { valor: 'DESESTIMADO', texto: 'Desestimados' }, { valor: 'todos', texto: 'Todos' },
];
const QUE = { PRODUCTO: 'Publicación', CALIFICACION: 'Comentario', PEDIDO: 'Pedido' };
const ESTADO = { PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', RESUELTO: 'Atendido', DESESTIMADO: 'Desestimado' };

/** CU-18 paso 1: reportes pendientes, del más antiguo al más reciente. */
export default function ReportesAdmin() {
  const router = useRouter();
  const [filtro, setFiltro] = useState('abiertos');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => {
    api.admin.reportes(filtro).then((r) => { setLista(r.reportes); setError(null); }).catch((err) => setError(mensajeDeError(err)));
  }, [filtro]));

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={lista || []}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={(
        <>
          {error ? <Aviso mensaje={error} /> : null}
          <Opciones opciones={FILTROS} valor={filtro} onCambiar={setFiltro} />
        </>
      )}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reporte de ${QUE[item.tipoContenido]}: ${item.motivoTexto}, contra ${item.reportado || 'desconocido'}, ${ESTADO[item.estado]}`}
          onPress={() => router.push(`/administrador/reporte/${item.id}`)}
          style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.fila}>
            <Text style={styles.titulo}>🚩 {QUE[item.tipoContenido]} · {item.motivoTexto}</Text>
            <Text style={styles.estado}>{ESTADO[item.estado]}</Text>
          </View>
          <Text style={styles.detalle}>Reportado: {item.reportado || '—'} · por {item.reportante} · {fechaCorta(item.fecha)}</Text>
          {item.descripcion ? <Text style={styles.descripcion} numberOfLines={2}>“{item.descripcion}”</Text> : null}
          {item.reportesDelContenido > 1 ? <Text style={styles.multiple}>{item.reportesDelContenido} reportes sobre el mismo contenido</Text> : null}
        </Pressable>
      )}
      ListEmptyComponent={lista ? <Text style={styles.vacio} testID="reportes-vacio">No hay reportes en esta vista.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m, maxWidth: 960, width: '100%', alignSelf: 'center' },
  tarjeta: { minHeight: toque.boton, borderWidth: 1, borderColor: colores.borde, borderRadius: 12, padding: espacio.m, marginBottom: espacio.s },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s },
  titulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto, flex: 1 },
  estado: { fontSize: texto.pequeno, fontWeight: '700', color: colores.primario },
  detalle: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: 2 },
  descripcion: { fontSize: texto.pequeno, fontStyle: 'italic', color: colores.texto, marginTop: espacio.xs },
  multiple: { fontSize: texto.pequeno, fontWeight: '700', color: colores.error, marginTop: espacio.xs },
  vacio: { textAlign: 'center', fontSize: texto.base, color: colores.textoSecundario, padding: espacio.xl },
});
