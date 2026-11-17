import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useBase } from '../hooks/useBase';
import { colores, espacio, texto, toque } from '../tema/tema';

/** Enlace discreto «🚩 Reportar…» que abre CU-19 con el contenido indicado. */
export function BotonReportar({ tipo, id, titulo, etiqueta = 'Reportar un problema' }) {
  const router = useRouter();
  const base = useBase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={() => router.push({ pathname: `${base}/reportar`, params: { tipo, id, titulo } })}
      style={({ pressed }) => [styles.boton, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.texto}>🚩 {etiqueta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: { minHeight: toque.minimo, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: espacio.xs },
  texto: { fontSize: texto.pequeno, color: colores.textoSecundario, textDecorationLine: 'underline' },
});
