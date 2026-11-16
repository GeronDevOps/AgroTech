import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CampoTexto } from '../../componentes/CampoTexto';
import { BotonGrande } from '../../componentes/BotonGrande';
import { Aviso } from '../../componentes/Aviso';
import { Casilla } from '../../componentes/Casilla';
import { Mosaico } from '../../componentes/Mosaico';
import { SelectorMunicipio } from '../../componentes/SelectorMunicipio';
import { ROLES, useSesion } from '../../sesion/SesionContext';
import { useConexion } from '../../hooks/useConexion';
import { limpiarTelefono, mensajeDeError, validarRegistro } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

const VERSION_AVISO = '1.0';

/**
 * CU-01 · Registrarse. Dos pasos para que cada pantalla tenga una sola tarea (UCD):
 *   1. ¿Vende o compra? (rol)   2. Datos + autorización de tratamiento de datos.
 */
export default function Registro() {
  const router = useRouter();
  const { registrar } = useSesion();
  const { enLinea } = useConexion();
  const scrollRef = useRef(null);
  const subir = () => scrollRef.current && scrollRef.current.scrollTo({ y: 0, animated: true });

  const [rol, setRol] = useState(null);
  const [datos, setDatos] = useState({
    nombres: '', apellidos: '', telefono: '', correo: '', municipio: null, veredaDireccion: '', contrasena: '',
    aceptaTratamientoDatos: false,
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cuentaExiste, setCuentaExiste] = useState(false);
  const [verAviso, setVerAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  async function crearCuenta() {
    const e = validarRegistro(datos);
    setErrores(e);
    setErrorGeneral(null);
    setCuentaExiste(false);
    if (Object.keys(e).length) {
      setErrorGeneral('Revise los datos marcados en rojo.');
      subir();
      return;
    }
    setEnviando(true);
    try {
      await registrar({
        ...datos,
        rol,
        nombres: datos.nombres.trim(),
        apellidos: datos.apellidos.trim(),
        correo: datos.correo.trim(),
        telefono: limpiarTelefono(datos.telefono),
        veredaDireccion: datos.veredaDireccion.trim() || undefined,
      });
      // CU-01 paso 4: la sesión queda abierta y el guard muestra la pantalla del rol.
    } catch (err) {
      if (err.codigo === 'DATOS_INVALIDOS' && err.detalles && err.detalles.campos) setErrores(err.detalles.campos);
      if (err.codigo === 'CUENTA_EXISTENTE') {
        setErrores({ [err.detalles.campo]: err.message });
        setCuentaExiste(true);
      }
      setErrorGeneral(mensajeDeError(err));
      setEnviando(false);
      subir();
    }
  }

  if (!rol) {
    return (
      <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
        <Text style={styles.paso}>Paso 1 de 2</Text>
        <Text style={styles.titulo} accessibilityRole="header">¿Cómo va a usar AgroTech?</Text>
        <View style={styles.rejilla}>
          <Mosaico icono="🌱" titulo="Vendo mi cosecha" detalle="Soy productor" color={colores.mosaicos.publicar} onPress={() => setRol(ROLES.PRODUCTOR)} />
          <Mosaico icono="🛒" titulo="Compro productos" detalle="Soy consumidor" color={colores.mosaicos.pedidos} onPress={() => setRol(ROLES.CONSUMIDOR)} />
        </View>
        <BotonGrande titulo="Ya tengo cuenta" variante="secundario" onPress={() => router.replace('/iniciar-sesion')} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.paso}>Paso 2 de 2</Text>
        <View style={styles.filaRol}>
          <Text style={styles.rolElegido}>{rol === ROLES.PRODUCTOR ? '🌱 Cuenta de productor' : '🛒 Cuenta de consumidor'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar tipo de cuenta" onPress={() => setRol(null)} style={styles.enlace}>
            <Text style={styles.enlaceTexto}>Cambiar</Text>
          </Pressable>
        </View>

        {!enLinea ? <Aviso tipo="sinSenal" mensaje="Sin señal. Puede llenar el formulario; para crear la cuenta necesita conexión." /> : null}
        {errorGeneral ? (
          <Aviso mensaje={errorGeneral} testID="error-registro">
            {cuentaExiste ? (
              <BotonGrande titulo="Ir a iniciar sesión" variante="secundario" onPress={() => router.replace('/iniciar-sesion')} />
            ) : null}
          </Aviso>
        ) : null}

        <CampoTexto etiqueta="Nombres" value={datos.nombres} onChangeText={cambiar('nombres')} error={errores.nombres} autoCapitalize="words" autoComplete="given-name" />
        <CampoTexto etiqueta="Apellidos" value={datos.apellidos} onChangeText={cambiar('apellidos')} error={errores.apellidos} autoCapitalize="words" autoComplete="family-name" />
        <CampoTexto etiqueta="Celular" value={datos.telefono} onChangeText={cambiar('telefono')} error={errores.telefono} keyboardType="phone-pad" autoComplete="tel" placeholder="310 555 1234" />
        <CampoTexto etiqueta="Correo" value={datos.correo} onChangeText={cambiar('correo')} error={errores.correo} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
        <SelectorMunicipio valor={datos.municipio} onCambiar={cambiar('municipio')} error={errores.municipio} />
        <CampoTexto
          etiqueta="Vereda o dirección (opcional)"
          value={datos.veredaDireccion}
          onChangeText={cambiar('veredaDireccion')}
          error={errores.veredaDireccion}
          ayuda={rol === ROLES.PRODUCTOR ? 'Ayuda a los compradores a saber dónde recoger.' : undefined}
        />
        <CampoTexto
          etiqueta="Contraseña"
          value={datos.contrasena}
          onChangeText={cambiar('contrasena')}
          error={errores.contrasena}
          secreto
          autoCapitalize="none"
          autoComplete="new-password"
          ayuda="Mínimo 8 caracteres, con letras y números."
        />

        <Casilla
          marcada={datos.aceptaTratamientoDatos}
          onCambiar={cambiar('aceptaTratamientoDatos')}
          etiqueta="Autorizo el tratamiento de mis datos personales"
          error={errores.aceptaTratamientoDatos}
          testID="casilla-autorizacion"
        >
          <Pressable accessibilityRole="button" onPress={() => setVerAviso(!verAviso)} style={styles.enlace}>
            <Text style={styles.enlaceTexto}>{verAviso ? 'Ocultar el aviso' : 'Leer el aviso de privacidad'}</Text>
          </Pressable>
          {verAviso ? <AvisoPrivacidad /> : null}
        </Casilla>

        <BotonGrande titulo={enviando ? 'Creando cuenta…' : 'Crear cuenta'} onPress={crearCuenta} deshabilitado={enviando || !enLinea} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Resumen del aviso de privacidad (Ley 1581 de 2012). La versión aceptada queda en autorizacion_datos. */
function AvisoPrivacidad() {
  return (
    <View style={styles.aviso}>
      <Text style={styles.avisoTexto}>
        AgroTech usa su nombre, celular, correo y municipio solo para crear su cuenta, mostrar sus productos o pedidos y
        comunicarlo con compradores o vendedores. No vendemos sus datos. Puede consultarlos, corregirlos o pedir que se
        borren escribiendo a la asociación. Versión {VERSION_AVISO}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l, paddingBottom: espacio.xl },
  paso: { fontSize: texto.pequeno, fontWeight: '700', color: colores.primario, marginBottom: espacio.xs },
  titulo: { fontSize: texto.grande, fontWeight: '700', color: colores.texto, marginBottom: espacio.l },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, marginBottom: espacio.l },
  filaRol: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espacio.m },
  rolElegido: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  enlace: { minHeight: 48, justifyContent: 'center' },
  enlaceTexto: { fontSize: texto.base, fontWeight: '700', color: colores.primario, textDecorationLine: 'underline' },
  aviso: { backgroundColor: colores.superficie, borderRadius: 8, padding: espacio.m },
  avisoTexto: { fontSize: texto.pequeno, color: colores.texto, lineHeight: 20 },
});
