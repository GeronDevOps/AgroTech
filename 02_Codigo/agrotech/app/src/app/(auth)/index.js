import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { IndicadorConexion } from '../../componentes/IndicadorConexion';
import { API_URL, api } from '../../api/cliente';
import { diagnosticoServidor } from '../../api/servidor';
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

/** Solo en desarrollo: estado de la conexión con la API; se vuelve a comprobar cada 5 s hasta conectar. */
function EstadoServidor() {
  const [estado, setEstado] = useState('Servidor: comprobando…');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    let temporizador;
    api.salud()
      .then((datos) => activo && setEstado(diagnosticoServidor({ ok: true, datos }, API_URL)))
      .catch((error) => {
        if (!activo) return;
        setEstado(diagnosticoServidor({ ok: false, error }, API_URL));
        temporizador = setTimeout(() => setIntento((n) => n + 1), 5000);
      });
    return () => { activo = false; clearTimeout(temporizador); };
  }, [intento]);
  return (
    <Pressable onPress={() => setIntento((n) => n + 1)} accessibilityRole="button" accessibilityLabel="Comprobar el servidor de nuevo">
      <Text style={styles.servidor} testID="estado-servidor">{estado}</Text>
    </Pressable>
  );
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
