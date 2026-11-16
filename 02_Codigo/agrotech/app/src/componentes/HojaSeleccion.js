import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotonGrande } from './BotonGrande';
import { estilosCampo } from './CampoTexto';
import { sinTildes } from '../datos/municipios';
import { colores, espacio, texto, toque } from '../tema/tema';

/**
 * Lista de opciones a pantalla completa para los filtros del catálogo (wireframe 3: "Municipio ▾ · Categoría ▾").
 * opciones: [{ valor, texto, icono? }]; la primera opción "Todos" tiene valor null.
 */
export function HojaSeleccion({ visible, titulo, opciones, valor, onElegir, onCerrar, buscador = false }) {
  const [filtro, setFiltro] = useState('');
  const lista = useMemo(() => {
    const f = sinTildes(filtro);
    return f ? opciones.filter((o) => o.valor === null || sinTildes(o.texto).includes(f)) : opciones;
  }, [filtro, opciones]);

  const elegir = (v) => {
    setFiltro('');
    onElegir(v);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.modal}>
        <Text style={styles.titulo} accessibilityRole="header">{titulo}</Text>
        {buscador ? (
          <View style={[estilosCampo.caja, styles.buscadorCaja]}>
            <TextInput
              accessibilityLabel={`Buscar en ${titulo}`}
              placeholder="Buscar…"
              placeholderTextColor={colores.textoSecundario}
              value={filtro}
              onChangeText={setFiltro}
              style={styles.buscador}
              autoCorrect={false}
            />
          </View>
        ) : null}
        <FlatList
          data={lista}
          keyExtractor={(o) => String(o.valor)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const elegida = item.valor === valor;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.texto}
                accessibilityState={{ selected: elegida }}
                onPress={() => elegir(item.valor)}
                style={({ pressed }) => [styles.opcion, elegida && styles.elegida, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.opcionTexto, elegida && styles.opcionTextoElegida]}>
                  {item.icono ? `${item.icono}  ` : ''}{item.texto}{elegida ? '  ✓' : ''}
                </Text>
              </Pressable>
            );
          }}
        />
        <BotonGrande titulo="Cerrar" variante="secundario" onPress={onCerrar} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colores.fondo, padding: espacio.m },
  titulo: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto, marginBottom: espacio.m },
  buscadorCaja: { marginBottom: espacio.s },
  buscador: { flex: 1, minWidth: 0, fontSize: texto.base, paddingHorizontal: espacio.m, minHeight: toque.boton, color: colores.texto },
  opcion: { minHeight: toque.boton, justifyContent: 'center', paddingHorizontal: espacio.m, borderBottomWidth: 1, borderBottomColor: colores.superficie },
  elegida: { backgroundColor: colores.primarioClaro },
  opcionTexto: { fontSize: texto.base, color: colores.texto },
  opcionTextoElegida: { fontWeight: '700', color: colores.enLineaTexto },
});
