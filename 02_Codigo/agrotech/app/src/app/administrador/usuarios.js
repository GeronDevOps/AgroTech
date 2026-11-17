import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Opciones } from '../../componentes/Opciones';
import { Aviso } from '../../componentes/Aviso';
import { api } from '../../api/cliente';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto, toque } from '../../tema/tema';

const VISTAS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'verificar', texto: 'Productores por verificar' },
  { valor: 'suspendidos', texto: 'Suspendidos' },
];
const FILTRO = {
  todos: {},
  verificar: { rol: 'PRODUCTOR', estado: 'ACTIVA', verificado: 'false' },
  suspendidos: { estado: 'SUSPENDIDA' },
};

/** CU-18: buscar usuarios por nombre, correo o celular; ver productores por verificar y cuentas suspendidas. */
export default function UsuariosAdmin() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [vista, setVista] = useState(params.vista || 'todos');
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);

  useFocusEffect(useCallback(() => {
    api.admin.usuarios({ ...FILTRO[vista], q: buscado || undefined })
      .then((r) => { setLista(r.usuarios); setError(null); })
      .catch((err) => setError(mensajeDeError(err)));
  }, [vista, buscado]));

  return (
    <FlatList
      style={styles.pantalla}
      contentContainerStyle={styles.lista}
      data={lista || []}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={(
        <>
          {error ? <Aviso mensaje={error} /> : null}
          <View style={styles.buscador}>
            <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => setBuscado(q.trim())} placeholder="Nombre, correo o celular"
              accessibilityLabel="Buscar usuarios" returnKeyType="search" style={styles.entrada} placeholderTextColor={colores.textoSecundario} />
            <Pressable accessibilityRole="button" accessibilityLabel="Buscar" onPress={() => setBuscado(q.trim())} style={styles.boton}><Text style={styles.icono}>🔎</Text></Pressable>
          </View>
          <Opciones opciones={VISTAS} valor={vista} onCambiar={setVista} />
        </>
      )}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.nombres} ${item.apellidos}, ${item.rol === 'PRODUCTOR' ? 'productor' : 'consumidor'}, ${item.estado.toLowerCase()}${item.verificado ? ', verificado' : ''}`}
          onPress={() => router.push(`/administrador/usuario/${item.id}`)}
          style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.nombre}>{item.nombres} {item.apellidos} {item.verificado ? '✔' : ''}</Text>
          <Text style={styles.detalle}>{item.rol === 'PRODUCTOR' ? '🌱 Productor' : '🛒 Consumidor'} · {item.municipio} · {item.estado === 'ACTIVA' ? 'activa' : '⛔ suspendida'}</Text>
          <Text style={styles.detalle}>{item.correo} · {item.telefono} · reportes recibidos: {item.historial.reportesRecibidos}</Text>
        </Pressable>
      )}
      ListEmptyComponent={lista ? <Text style={styles.vacio}>No hay usuarios en esta vista.</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.m, maxWidth: 960, width: '100%', alignSelf: 'center' },
  buscador: { flexDirection: 'row', borderWidth: 2, borderColor: colores.borde, borderRadius: 12, marginBottom: espacio.s },
  entrada: { flex: 1, minHeight: toque.minimo, fontSize: texto.base, paddingHorizontal: espacio.m, color: colores.texto },
  boton: { minWidth: toque.minimo, alignItems: 'center', justifyContent: 'center' },
  icono: { fontSize: texto.titulo },
  tarjeta: { borderWidth: 1, borderColor: colores.borde, borderRadius: 12, padding: espacio.m, marginBottom: espacio.s },
  nombre: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  detalle: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: 2 },
  vacio: { textAlign: 'center', fontSize: texto.base, color: colores.textoSecundario, padding: espacio.xl },
});
