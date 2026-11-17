import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Mosaico } from '../../componentes/Mosaico';
import { BotonGrande } from '../../componentes/BotonGrande';
import { Aviso } from '../../componentes/Aviso';
import { api } from '../../api/cliente';
import { useSesion } from '../../sesion/SesionContext';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/** CU-18 paso 1 · Resumen del panel: lo que está esperando una decisión del administrador. */
export default function PanelAdministrador() {
  const router = useRouter();
  const { usuario, cerrarSesion } = useSesion();
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => {
    api.admin.resumen().then((x) => { setR(x); setError(null); }).catch((err) => setError(mensajeDeError(err)));
  }, []));

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Text style={styles.saludo} accessibilityRole="header">Hola, {usuario.nombres}</Text>
      {error ? <Aviso mensaje={error} /> : null}
      {r ? (
        <View style={styles.kpis} testID="resumen-admin">
          <Kpi etiqueta="Productores activos" valor={r.productores} />
          <Kpi etiqueta="Consumidores activos" valor={r.consumidores} />
          <Kpi etiqueta="Publicaciones activas" valor={r.publicacionesActivas} />
          <Kpi etiqueta="Pedidos en curso" valor={r.pedidosEnCurso} />
        </View>
      ) : null}
      <View style={styles.rejilla}>
        <Mosaico icono="🚩" titulo="Reportes" color={colores.mosaicos.productos}
          detalle={r && r.reportesAbiertos ? `${r.reportesAbiertos} por revisar` : null} alerta={!!(r && r.reportesAbiertos)}
          onPress={() => router.push('/administrador/reportes')} />
        <Mosaico icono="✔" titulo="Verificar productores" color={colores.mosaicos.publicar}
          detalle={r && r.productoresPorVerificar ? `${r.productoresPorVerificar} pendientes` : null} alerta={!!(r && r.productoresPorVerificar)}
          onPress={() => router.push({ pathname: '/administrador/usuarios', params: { vista: 'verificar' } })} />
        <Mosaico icono="👥" titulo="Usuarios" color={colores.mosaicos.ventas}
          detalle={r && r.cuentasSuspendidas ? `${r.cuentasSuspendidas} suspendidas` : null}
          onPress={() => router.push('/administrador/usuarios')} />
        <Mosaico icono="🔒" titulo="Supresión de datos" color={colores.mosaicos.mensajes}
          detalle={r && r.supresionesEnTramite ? `${r.supresionesEnTramite} en trámite` : null}
          onPress={() => router.push('/administrador/supresiones')} />
        <Mosaico icono="📜" titulo="Bitácora" color={colores.mosaicos.pedidos} onPress={() => router.push('/administrador/bitacora')} />
      </View>
      <BotonGrande titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
    </ScrollView>
  );
}

function Kpi({ etiqueta, valor }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Text style={styles.kpiValor}>{valor}</Text>
      <Text style={styles.kpiEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, maxWidth: 960, width: '100%', alignSelf: 'center' },
  saludo: { fontSize: texto.grande, fontWeight: '700', color: colores.texto, marginVertical: espacio.m },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.m },
  kpi: { flexGrow: 1, flexBasis: 140, backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m },
  kpiValor: { fontSize: texto.grande, fontWeight: '800', color: colores.primario },
  kpiEtiqueta: { fontSize: texto.pequeno, color: colores.textoSecundario },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, marginBottom: espacio.l },
});
