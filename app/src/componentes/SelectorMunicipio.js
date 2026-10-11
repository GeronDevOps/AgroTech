import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MUNICIPIOS, sinTildes } from '../datos/municipios';
import { estilosCampo } from './CampoTexto';
import { BotonGrande } from './BotonGrande';
import { colores, espacio, texto, toque } from '../tema/tema';

/**
 * Selector de municipio (wireframes UCD: "selectores en lugar de texto libre").
 * Abre una lista de los 40 municipios con buscador que ignora tildes.
 */
export function SelectorMunicipio({ valor, onCambiar, error }) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');

  const lista = useMemo(() => {
    const f = sinTildes(filtro);
    return f ? MUNICIPIOS.filter((m) => sinTildes(m).includes(f)) : MUNICIPIOS;
  }, [filtro]);

  const elegir = (m) => {
    onCambiar(m);
    setAbierto(false);
    setFiltro('');
  };

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>Municipio</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={valor ? `Municipio: ${valor}. Cambiar` : 'Elegir municipio'}
        onPress={() => setAbierto(true)}
        style={[estilosCampo.caja, error && estilosCampo.cajaError, styles.campo]}
      >
        <Text style={[styles.valor, !valor && styles.vacio]}>{valor || 'Elegir municipio'}</Text>
        <Text style={styles.flecha} importantForAccessibility="no">▾</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <SafeAreaView style={styles.modal}>
          <Text style={styles.tituloModal} accessibilityRole="header">¿En qué municipio está?</Text>
          <View style={estilosCampo.caja}>
            <TextInput
              accessibilityLabel="Buscar municipio"
              placeholder="Buscar…"
              placeholderTextColor={colores.textoSecundario}
              value={filtro}
              onChangeText={setFiltro}
              style={styles.buscador}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={lista}
            keyExtractor={(m) => m}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item}
                accessibilityState={{ selected: item === valor }}
                onPress={() => elegir(item)}
                style={({ pressed }) => [styles.opcion, item === valor && styles.opcionElegida, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.opcionTexto}>{item}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.vacioLista}>No hay municipios con ese nombre.</Text>}
          />
          <BotonGrande titulo="Cancelar" variante="secundario" onPress={() => setAbierto(false)} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: espacio.m },
  etiqueta: { fontSize: texto.base, fontWeight: '700', color: colores.texto, marginBottom: espacio.xs },
  campo: { paddingHorizontal: espacio.m, justifyContent: 'space-between' },
  valor: { fontSize: texto.base, color: colores.texto },
  vacio: { color: colores.textoSecundario },
  flecha: { fontSize: texto.base, color: colores.primario },
  error: { fontSize: texto.pequeno, color: colores.error, fontWeight: '600', marginTop: espacio.xs },
  modal: { flex: 1, backgroundColor: colores.fondo, padding: espacio.m },
  tituloModal: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto, marginBottom: espacio.m },
  buscador: { flex: 1, minWidth: 0, fontSize: texto.base, paddingHorizontal: espacio.m, minHeight: toque.boton, color: colores.texto },
  opcion: { minHeight: toque.boton, justifyContent: 'center', paddingHorizontal: espacio.m, borderBottomWidth: 1, borderBottomColor: colores.superficie },
  opcionElegida: { backgroundColor: colores.primarioClaro },
  opcionTexto: { fontSize: texto.base, color: colores.texto },
  vacioLista: { fontSize: texto.base, color: colores.textoSecundario, padding: espacio.m },
});
