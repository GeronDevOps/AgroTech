import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { Aviso } from '../../../componentes/Aviso';
import { api } from '../../../api/cliente';
import { fechaCorta } from '../../../componentes/TarjetaPedido';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

/** CU-18 paso 4 y A2: verificar al productor, suspender (con confirmación si hay pedidos en curso) o reactivar. */
export default function UsuarioAdmin() {
  const { id } = useLocalSearchParams();
  const [d, setD] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [suspendiendo, setSuspendiendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmacion, setConfirmacion] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    api.admin.usuario(id).then(setD).catch((err) => setAviso({ tipo: 'error', mensaje: mensajeDeError(err) }));
  }, [id]);
  useFocusEffect(cargar);

  async function hacer(fn, ok) {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fn();
      setD((x) => ({ ...x, usuario: r.usuario }));
      setAviso({ tipo: 'info', mensaje: ok(r) });
      setSuspendiendo(false);
      setConfirmacion(null);
    } catch (err) {
      if (err.codigo === 'REQUIERE_CONFIRMACION') setConfirmacion(err.message);
      else setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setOcupado(false);
    }
  }
  const suspender = (confirmar) => {
    if (motivo.trim().length < 5) { setAviso({ tipo: 'error', mensaje: 'Escriba el motivo de la suspensión (mínimo 5 caracteres).' }); return; }
    hacer(() => api.admin.suspender(id, motivo.trim(), confirmar), (r) => `✓ Cuenta suspendida y sesión cerrada.${r.pedidosCancelados ? ` Se cancelaron ${r.pedidosCancelados} pedido(s) en curso y se avisó a la otra parte.` : ''}`);
  };

  if (!d) return <View style={styles.centro}>{aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;
  const u = d.usuario;
  const h = u.historial;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-usuario-admin" /> : null}
      <Text style={styles.titulo} accessibilityRole="header">{u.nombres} {u.apellidos} {u.verificado ? '✔' : ''}</Text>
      <Text style={styles.dato}>{u.rol === 'PRODUCTOR' ? 'Productor' : 'Consumidor'} · {u.municipio} · registrado el {fechaCorta(u.fechaRegistro)}</Text>
      <Text style={styles.dato}>{u.correo} · {u.telefono}</Text>
      <Text style={[styles.dato, u.estado !== 'ACTIVA' && styles.alerta]} testID="estado-cuenta">Cuenta {u.estado.toLowerCase()}{u.motivoEstado ? `: ${u.motivoEstado}` : ''}</Text>

      <View style={styles.caja}>
        <Text style={styles.subtitulo}>Historial</Text>
        <Text style={styles.dato}>Pedidos: {h.pedidosEntregados} entregados · {h.pedidosCancelados} cancelados · {h.pedidosEnCurso} en curso</Text>
        <Text style={styles.dato}>Reportes recibidos: {h.reportesRecibidos} (confirmados {h.reportesConfirmados}) · hechos: {h.reportesHechos}</Text>
        {h.calificacion ? <Text style={styles.dato}>Calificación ★ {String(h.calificacion.promedio).replace('.', ',')} ({h.calificacion.total})</Text> : null}
        {d.reportesRecibidos.map((r) => <Text key={r.id} style={styles.dato}>• {fechaCorta(r.fecha)} · {r.motivoTexto} · {r.estado.toLowerCase()}</Text>)}
      </View>

      {u.rol === 'PRODUCTOR' && u.estado === 'ACTIVA' ? (
        <BotonGrande
          titulo={u.verificado ? 'Quitar verificación' : '✔ Marcar como productor verificado'}
          variante={u.verificado ? 'secundario' : 'primario'}
          onPress={() => hacer(() => api.admin.verificar(id, !u.verificado), (r) => (r.usuario.verificado ? '✓ Productor verificado. Sus publicaciones muestran el sello.' : '✓ Se quitó la verificación.'))}
          deshabilitado={ocupado}
        />
      ) : null}

      {u.estado === 'SUSPENDIDA' ? (
        <BotonGrande titulo="Reactivar cuenta" onPress={() => hacer(() => api.admin.reactivar(id), () => '✓ Cuenta reactivada. Se avisó al usuario.')} deshabilitado={ocupado} />
      ) : suspendiendo ? (
        <View style={styles.peligro}>
          <CampoTexto etiqueta="Motivo de la suspensión" value={motivo} onChangeText={setMotivo} maxLength={200} />
          {confirmacion ? (
            <Aviso mensaje={confirmacion} testID="confirmar-suspension">
              <BotonGrande titulo="Confirmar suspensión" onPress={() => suspender(true)} deshabilitado={ocupado} />
            </Aviso>
          ) : <BotonGrande titulo="Suspender" onPress={() => suspender(false)} deshabilitado={ocupado} />}
          <BotonGrande titulo="Cancelar" variante="secundario" onPress={() => { setSuspendiendo(false); setConfirmacion(null); }} />
        </View>
      ) : (
        <BotonGrande titulo="⛔ Suspender cuenta" variante="secundario" onPress={() => setSuspendiendo(true)} deshabilitado={ocupado} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl, maxWidth: 960, width: '100%', alignSelf: 'center' },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  subtitulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  dato: { fontSize: texto.pequeno, color: colores.texto, marginVertical: 2 },
  alerta: { color: colores.error, fontWeight: '700' },
  caja: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginVertical: espacio.m },
  peligro: { borderWidth: 2, borderColor: colores.error, borderRadius: 12, padding: espacio.m },
});
