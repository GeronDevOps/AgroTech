import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Mosaico } from '../../componentes/Mosaico';
import { BotonGrande } from '../../componentes/BotonGrande';
import { useSesion } from '../../sesion/SesionContext';
import { api } from '../../api/cliente';
import { Aviso } from '../../componentes/Aviso';
import { pedidosLocal } from '../../local/cache';
import { useSincronizacion } from '../../sync/SincronizacionContext';
import { colores, espacio, texto } from '../../tema/tema';

/** Inicio del productor (wireframe 1): cada tarea crítica queda a un toque (RNF-02). */
export default function InicioProductor() {
  const router = useRouter();
  const { usuario, cerrarSesion } = useSesion();
  const sync = useSincronizacion();
  const [pendientes, setPendientes] = useState(0);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  // Al volver al inicio se cuentan los pedidos por atender (RF-13). Sin red, con la copia del teléfono.
  useFocusEffect(useCallback(() => {
    let vigente = true;
    api.pedidos('activos')
      .then((r) => r.pedidos)
      .catch((err) => (err.codigo === 'SIN_CONEXION' ? pedidosLocal({ soloActivos: true }) : null))
      .then((lista) => { if (vigente && lista) setPendientes(lista.filter((p) => p.estado === 'PENDIENTE').length); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []));

  const enCola = sync.pendientes + sync.conError;
  const detalleProductos = sync.conError ? `${sync.conError} con error` : sync.pendientes ? `${sync.pendientes} sin sincronizar` : null;

  // Cerrar sesión borra la copia local y la cola: si hay cambios sin enviar se pide confirmación.
  const salir = () => {
    if (enCola && !confirmarSalida) setConfirmarSalida(true);
    else cerrarSesion();
  };

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Text style={styles.saludo} accessibilityRole="header">Hola, {usuario.nombres}</Text>
      <View style={styles.rejilla}>
        <Mosaico icono="＋" titulo="Publicar producto" color={colores.mosaicos.publicar} onPress={() => router.push('/productor/publicar')} />
        <Mosaico
          icono="🧺" titulo="Mis productos" color={colores.mosaicos.productos}
          detalle={detalleProductos} alerta={sync.conError > 0}
          onPress={() => router.push('/productor/productos')} />
        <Mosaico
          icono="▤" titulo="Mis pedidos" color={colores.mosaicos.pedidos}
          detalle={pendientes ? `${pendientes} por atender` : null} alerta={pendientes > 0}
          onPress={() => router.push('/productor/pedidos')} />
        <Mosaico icono="▲" titulo="Mis ventas" color={colores.mosaicos.ventas} onPress={() => router.push('/productor/ventas')} />
        <Mosaico icono="✉" titulo="Mensajes" color={colores.mosaicos.mensajes} onPress={() => router.push('/productor/mensajes')} />
      </View>
      {confirmarSalida ? (
        <Aviso
          testID="aviso-salida"
          mensaje={`Tiene ${enCola === 1 ? 'un cambio' : `${enCola} cambios`} sin enviar. Si cierra sesión ahora se perderán. Espere a tener señal o confirme.`}
        >
          <BotonGrande titulo="Cancelar" variante="secundario" onPress={() => setConfirmarSalida(false)} />
        </Aviso>
      ) : null}
      <BotonGrande titulo={confirmarSalida ? 'Cerrar sesión de todos modos' : 'Cerrar sesión'} variante="secundario" onPress={salir} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m },
  saludo: { fontSize: texto.grande, fontWeight: '700', color: colores.texto, marginVertical: espacio.m },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, marginBottom: espacio.l },
});
