import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { CampoTexto } from '../../componentes/CampoTexto';
import { BotonGrande } from '../../componentes/BotonGrande';
import { Aviso } from '../../componentes/Aviso';
import { api } from '../../api/cliente';
import { useSesion } from '../../sesion/SesionContext';
import { useConexion } from '../../hooks/useConexion';
import { errorContrasena, mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/**
 * CU-08 · Recuperar la contraseña (RF-08).
 * Paso 1-2: correo → mensaje neutro (no revela si la cuenta existe, A1).
 * Paso 3-4: código de 6 dígitos (15 min, 3 intentos, A2) + nueva contraseña con la política (A3).
 * Al terminar se cierran las demás sesiones y se entra con la nueva.
 */
export default function Recuperar() {
  const router = useRouter();
  const { abrirSesion } = useSesion();
  const { enLinea } = useConexion();
  const [paso, setPaso] = useState(1);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function pedirCodigo() {
    setErrores({});
    setAviso(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) { setErrores({ correo: 'Escriba el correo con el que creó la cuenta.' }); return; }
    setEnviando(true);
    try {
      const r = await api.recuperar(correo.trim());
      setAviso({ tipo: 'info', mensaje: r.mensaje });
      setPaso(2);
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  async function cambiar() {
    const e = {};
    if (!/^\d{6}$/.test(codigo.replace(/\s/g, ''))) e.codigo = 'El código tiene 6 dígitos.';
    const errClave = errorContrasena(contrasena);
    if (errClave) e.contrasena = errClave;
    setErrores(e);
    setAviso(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const r = await api.restablecer({ correo: correo.trim(), codigo: codigo.replace(/\s/g, ''), contrasena });
      await abrirSesion(r); // el guard del rol lleva a su inicio
    } catch (err) {
      if (['CODIGO_AGOTADO', 'CODIGO_VENCIDO', 'CODIGO_INVALIDO'].includes(err.codigo)) {
        setPaso(1); // A2: el proceso se reinicia
        setCodigo('');
      }
      if (err.detalles && err.detalles.campos) setErrores(err.detalles.campos);
      setAviso({ tipo: 'error', mensaje: err.codigo === 'CODIGO_INCORRECTO' ? `${err.message} Le quedan ${err.detalles.intentosRestantes} intento(s).` : mensajeDeError(err) });
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo} accessibilityRole="header">{paso === 1 ? '¿Olvidó su contraseña?' : 'Escriba el código'}</Text>
        {!enLinea ? <Aviso tipo="sinSenal" mensaje="Sin señal. Necesita conexión para recuperar la contraseña." /> : null}
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-recuperar" /> : null}
        {paso === 1 ? (
          <>
            <Text style={styles.texto}>Le enviaremos un código de 6 dígitos a su correo.</Text>
            <CampoTexto etiqueta="Correo" value={correo} onChangeText={setCorreo} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <BotonGrande titulo={enviando ? 'Enviando…' : 'Enviar código'} onPress={pedirCodigo} deshabilitado={enviando || !enLinea} />
          </>
        ) : (
          <>
            <CampoTexto etiqueta="Código de 6 dígitos" value={codigo} onChangeText={(t) => setCodigo(t.replace(/[^\d]/g, '').slice(0, 6))} error={errores.codigo} keyboardType="number-pad" autoComplete="one-time-code" />
            <CampoTexto etiqueta="Nueva contraseña" value={contrasena} onChangeText={setContrasena} error={errores.contrasena} secreto autoCapitalize="none" autoComplete="new-password"
              ayuda="Mínimo 8 caracteres, con letras y números." />
            <BotonGrande titulo={enviando ? 'Guardando…' : 'Cambiar contraseña'} onPress={cambiar} deshabilitado={enviando || !enLinea} />
            <BotonGrande titulo="No me llegó: enviar otro código" variante="secundario" onPress={() => { setPaso(1); setAviso(null); }} />
          </>
        )}
        <BotonGrande titulo="Volver a iniciar sesión" variante="secundario" onPress={() => router.replace('/iniciar-sesion')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l },
  titulo: { fontSize: texto.grande, fontWeight: '700', color: colores.texto, marginBottom: espacio.m },
  texto: { fontSize: texto.base, color: colores.textoSecundario, marginBottom: espacio.m },
});
