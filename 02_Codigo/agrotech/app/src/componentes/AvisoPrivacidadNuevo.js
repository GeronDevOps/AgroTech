import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotonGrande } from './BotonGrande';
import { Aviso } from './Aviso';
import { useSesion } from '../sesion/SesionContext';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

/**
 * CU-20 A3 · Nuevo aviso de privacidad: se pide la nueva autorización en el siguiente inicio de sesión.
 * Sin aceptarla, la persona puede cerrar sesión (Ley 1581: la autorización es previa y expresa).
 */
export function AvisoPrivacidadNuevo() {
  const { requiereAutorizacion, versionAviso, aceptarAviso, cerrarSesion } = useSesion();
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  if (!requiereAutorizacion) return null;

  async function aceptar() {
    setEnviando(true);
    try {
      await aceptarAviso();
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => {}}>
      <SafeAreaView style={styles.pantalla}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <Text style={styles.titulo} accessibilityRole="header">🔒 Actualizamos el aviso de privacidad</Text>
          <Text style={styles.texto}>
            Publicamos la versión {versionAviso} del aviso de privacidad de AgroTech. Seguimos usando sus datos solo para
            identificarlo en sus pedidos, iniciar sesión y mostrarle productos cerca de usted. Puede consultarlos,
            corregirlos o pedir que se borren en «Mi cuenta → Privacidad y datos».
          </Text>
          {error ? <Aviso mensaje={error} /> : null}
          <BotonGrande titulo={enviando ? 'Guardando…' : 'Acepto el tratamiento de mis datos'} onPress={aceptar} deshabilitado={enviando} />
          <BotonGrande titulo="No acepto · cerrar sesión" variante="secundario" onPress={cerrarSesion} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto, marginBottom: espacio.m },
  texto: { fontSize: texto.base, color: colores.texto, marginBottom: espacio.l, lineHeight: 26 },
});
