import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colores, espacio, texto, toque } from '../tema/tema';

/**
 * Campo de formulario accesible (RNF-02): etiqueta visible arriba, alto de 56 dp,
 * texto de 18 y error en rojo debajo del campo (CU-01 A2).
 * Con `secreto` muestra el botón "Mostrar/Ocultar" para revisar la contraseña.
 */
export const CampoTexto = forwardRef(function CampoTexto(
  { etiqueta, error, ayuda, secreto = false, style, testID, ...props },
  ref,
) {
  const [oculto, setOculto] = useState(true);
  return (
    <View style={[styles.contenedor, style]}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={[styles.caja, error && styles.cajaError]}>
        <TextInput
          ref={ref}
          accessibilityLabel={etiqueta}
          accessibilityHint={error || ayuda}
          placeholderTextColor={colores.textoSecundario}
          secureTextEntry={secreto && oculto}
          style={styles.entrada}
          testID={testID}
          {...props}
        />
        {secreto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            onPress={() => setOculto(!oculto)}
            style={styles.mostrar}
          >
            <Text style={styles.mostrarTexto}>{oculto ? 'Mostrar' : 'Ocultar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      {!error && ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
    </View>
  );
});

export const estilosCampo = StyleSheet.create({
  caja: {
    minHeight: toque.boton,
    borderWidth: 2,
    borderColor: colores.borde,
    borderRadius: 12,
    backgroundColor: colores.fondo,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cajaError: { borderColor: colores.error },
});

const styles = StyleSheet.create({
  contenedor: { marginBottom: espacio.m },
  etiqueta: { fontSize: texto.base, fontWeight: '700', color: colores.texto, marginBottom: espacio.xs },
  ...estilosCampo,
  entrada: { flex: 1, minWidth: 0, fontSize: texto.base, color: colores.texto, paddingHorizontal: espacio.m, minHeight: toque.boton },
  mostrar: { minHeight: toque.minimo, justifyContent: 'center', paddingHorizontal: espacio.m },
  mostrarTexto: { fontSize: texto.pequeno, fontWeight: '700', color: colores.primario },
  error: { fontSize: texto.pequeno, color: colores.error, marginTop: espacio.xs, fontWeight: '600' },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: espacio.xs },
});
