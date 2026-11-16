import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { CampoTexto } from '../../componentes/CampoTexto';
import { BotonGrande } from '../../componentes/BotonGrande';
import { Aviso } from '../../componentes/Aviso';
import { useSesion } from '../../sesion/SesionContext';
import { useConexion } from '../../hooks/useConexion';
import { mensajeDeError, validarInicio } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/**
 * CU-21 · Iniciar sesión (wireframe de acceso).
 * Correo o celular + contraseña. Mensaje genérico ante credenciales inválidas (A1),
 * aviso de bloqueo con la hora de desbloqueo y aviso sin señal sin borrar lo escrito (A4).
 */
export default function IniciarSesion() {
  const router = useRouter();
  const { iniciarSesion } = useSesion();
  const { enLinea } = useConexion();
  const claveRef = useRef(null);

  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function ingresar() {
    const e = validarInicio({ identificador, contrasena });
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      await iniciarSesion(identificador.trim(), contrasena);
      // La navegación cambia sola: el guard del rol muestra su pantalla principal.
    } catch (err) {
      setErrorGeneral(mensajeDeError(err));
      if (err.codigo === 'CREDENCIALES_INVALIDAS') setContrasena('');
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo} accessibilityRole="header">Ingrese a su cuenta</Text>

        {!enLinea ? <Aviso tipo="sinSenal" mensaje="Sin señal. Necesita conexión para iniciar sesión." /> : null}
        {errorGeneral ? <Aviso mensaje={errorGeneral} testID="error-sesion" /> : null}

        <CampoTexto
          etiqueta="Correo o celular"
          value={identificador}
          onChangeText={setIdentificador}
          error={errores.identificador}
          placeholder="Ej.: 310 555 1234"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => claveRef.current && claveRef.current.focus()}
        />
        <CampoTexto
          ref={claveRef}
          etiqueta="Contraseña"
          value={contrasena}
          onChangeText={setContrasena}
          error={errores.contrasena}
          secreto
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={ingresar}
        />

        <BotonGrande
          titulo={enviando ? 'Ingresando…' : 'Ingresar'}
          onPress={ingresar}
          deshabilitado={enviando || !enLinea}
        />
        <BotonGrande titulo="¿Olvidó su contraseña?" variante="secundario" onPress={() => router.push('/recuperar')} />
        <Text style={styles.separador}>¿Todavía no tiene cuenta?</Text>
        <BotonGrande titulo="Crear cuenta" variante="secundario" onPress={() => router.replace('/registro')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l },
  titulo: { fontSize: texto.grande, fontWeight: '700', color: colores.texto, marginBottom: espacio.l },
  separador: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', marginTop: espacio.l },
});
