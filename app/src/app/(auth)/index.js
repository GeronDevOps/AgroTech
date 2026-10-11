import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { IndicadorConexion } from '../../componentes/IndicadorConexion';
import { api } from '../../api/cliente';
import { ROLES, useSesion } from '../../sesion/SesionContext';
import { colores, espacio, texto } from '../../tema/tema';

/** Bienvenida: punto de entrada sin sesión. */
export default function Bienvenida() {
  const router = useRouter();
  const { iniciarDemo } = useSesion();
  const servidor = useEstadoServidor();

  return (
    <SafeAreaView style={styles.pantalla}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.fila}>
          <IndicadorConexion />
        </View>
        <Text style={styles.marca} accessibilityRole="header">AgroTech</Text>
        <Text style={styles.lema}>Vende tu cosecha directo, sin intermediarios.</Text>

        <BotonGrande titulo="Iniciar sesión" onPress={() => router.push('/iniciar-sesion')} />
        <BotonGrande titulo="Crear cuenta" variante="secundario" onPress={() => router.push('/registro')} />

        {__DEV__ ? (
          <View style={styles.demo}>
            <Text style={styles.demoTitulo}>Modo demostración (Fase 1)</Text>
            <Text style={styles.demoTexto}>Permite revisar la navegación por rol mientras se construye el inicio de sesión.</Text>
            <BotonGrande titulo="Entrar como productor" variante="secundario" onPress={() => iniciarDemo(ROLES.PRODUCTOR)} />
            <BotonGrande titulo="Entrar como consumidor" variante="secundario" onPress={() => iniciarDemo(ROLES.CONSUMIDOR)} />
            <Text style={styles.servidor} testID="estado-servidor">{servidor}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Comprueba GET /api/v1/salud para confirmar que el teléfono llega a la API. */
function useEstadoServidor() {
  const [estado, setEstado] = useState('Servidor: comprobando…');
  useEffect(() => {
    let activo = true;
    api.salud()
      .then((r) => activo && setEstado(`Servidor: conectado · migración ${r.baseDeDatos.migracion}`))
      .catch((e) => activo && setEstado(`Servidor: sin conexión (${e.codigo})`));
    return () => { activo = false; };
  }, []);
  return estado;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l, paddingBottom: espacio.xl },
  fila: { flexDirection: 'row', justifyContent: 'flex-end' },
  marca: { fontSize: 40, fontWeight: '800', color: colores.primario, textAlign: 'center', marginTop: espacio.xl },
  lema: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', marginVertical: espacio.l },
  demo: { marginTop: espacio.xl, padding: espacio.m, borderRadius: 12, backgroundColor: colores.superficie },
  demoTitulo: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  demoTexto: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.s },
  servidor: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: espacio.s, textAlign: 'center' },
});
