import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { IndicadorConexion } from '../../componentes/IndicadorConexion';
import { api } from '../../api/cliente';
import { colores, espacio, texto } from '../../tema/tema';

/** Bienvenida: punto de entrada sin sesión. */
export default function Bienvenida() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.pantalla}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.fila}>
          <IndicadorConexion />
        </View>
        <Text style={styles.icono} importantForAccessibility="no">🌱</Text>
        <Text style={styles.marca} accessibilityRole="header">AgroTech</Text>
        <Text style={styles.lema}>Vende tu cosecha directo, sin intermediarios.</Text>

        <BotonGrande titulo="Iniciar sesión" onPress={() => router.push('/iniciar-sesion')} />
        <BotonGrande titulo="Crear cuenta" variante="secundario" onPress={() => router.push('/registro')} />

        {__DEV__ ? <EstadoServidor /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Solo en desarrollo: confirma que el teléfono llega a la API (GET /api/v1/salud). */
function EstadoServidor() {
  const [estado, setEstado] = useState('Servidor: comprobando…');
  useEffect(() => {
    let activo = true;
    api.salud()
      .then((r) => activo && setEstado(`Servidor: conectado · migración ${r.baseDeDatos.migracion}`))
      .catch((e) => activo && setEstado(`Servidor: sin conexión (${e.codigo})`));
    return () => { activo = false; };
  }, []);
  return <Text style={styles.servidor} testID="estado-servidor">{estado}</Text>;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l, paddingBottom: espacio.xl },
  fila: { flexDirection: 'row', justifyContent: 'flex-end' },
  icono: { fontSize: 56, textAlign: 'center', marginTop: espacio.xl },
  marca: { fontSize: 40, fontWeight: '800', color: colores.primario, textAlign: 'center' },
  lema: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', marginVertical: espacio.l },
  servidor: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: espacio.xl, textAlign: 'center' },
});
