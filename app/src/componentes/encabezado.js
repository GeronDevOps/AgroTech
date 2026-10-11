import { View } from 'react-native';
import { IndicadorConexion } from './IndicadorConexion';
import { colores, texto } from '../tema/tema';

/** Opciones comunes del encabezado: barra verde de alto contraste e indicador de conexión. */
export const opcionesEncabezado = {
  headerStyle: { backgroundColor: colores.primario },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontSize: texto.titulo, fontWeight: '700' },
  headerRight: () => (
    <View style={{ marginRight: 12 }}>
      <IndicadorConexion />
    </View>
  ),
};
