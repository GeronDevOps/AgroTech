import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { Opciones } from '../../../componentes/Opciones';
import { Aviso } from '../../../componentes/Aviso';
import { api } from '../../../api/cliente';
import { fechaCorta } from '../../../componentes/TarjetaPedido';
import { formatoPesos } from '../../../utilidades/formato';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

const DECISIONES = {
  DESESTIMAR: { texto: 'Desestimar', icono: '—' },
  OCULTAR: { texto: 'Ocultar contenido', icono: '🙈' },
  SUSPENDER: { texto: 'Suspender cuenta', icono: '⛔' },
};

/**
 * CU-18 pasos 2-3 · Revisar un reporte: contenido, historial del usuario reportado y del reportante;
 * decidir desestimar (A1: marcar malintencionado), ocultar o suspender (A2: confirmar si hay pedidos en curso).
 */
export default function RevisarReporte() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [d, setD] = useState(null);
  const [decision, setDecision] = useState(null);
  const [resolucion, setResolucion] = useState('');
  const [malintencionado, setMalintencionado] = useState('no');
  const [confirmacion, setConfirmacion] = useState(null);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useFocusEffect(useCallback(() => {
    api.admin.reporte(id).then(setD).catch((err) => setAviso({ tipo: 'error', mensaje: mensajeDeError(err) }));
  }, [id]));

  if (!d) return <View style={styles.centro}>{aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;

  const { reporte, contenido, reportado, reportante } = d;
  const abierto = ['PENDIENTE', 'EN_REVISION'].includes(reporte.estado);

  async function resolver(confirmar = false) {
    const e = {};
    if (!decision) e.decision = 'Elija una decisión.';
    if (resolucion.trim().length < 5) e.resolucion = 'Explique la decisión (mínimo 5 caracteres). El usuario la verá.';
    setErrores(e);
    setAviso(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const r = await api.admin.resolver(id, { decision, resolucion: resolucion.trim(), malintencionado: decision === 'DESESTIMAR' && malintencionado === 'si', confirmar });
      setConfirmacion(null);
      setD((x) => ({ ...x, reporte: r.reporte }));
      setAviso({ tipo: 'info', mensaje: `✓ Decisión registrada en la bitácora.${r.reportesCerrados > 1 ? ` Se cerraron ${r.reportesCerrados} reportes del mismo contenido.` : ''}${r.pedidosCancelados ? ` Se cancelaron ${r.pedidosCancelados} pedido(s) en curso.` : ''} Se avisó a los involucrados.` });
    } catch (err) {
      if (err.codigo === 'REQUIERE_CONFIRMACION') setConfirmacion(err.message);
      else setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-reporte-admin" /> : null}
      <Text style={styles.titulo} accessibilityRole="header">{reporte.motivoTexto}</Text>
      <Text style={styles.sub}>Estado: {reporte.estado.replace('_', ' ').toLowerCase()} · {fechaCorta(reporte.fecha)}</Text>
      {reporte.descripcion ? <Text style={styles.cita}>“{reporte.descripcion}”</Text> : null}

      <Seccion titulo="Contenido reportado">
        {!contenido ? <Text style={styles.dato}>El contenido ya no existe.</Text> : null}
        {contenido && contenido.tipo === 'PRODUCTO' ? (
          <View style={styles.filaContenido} testID="contenido-producto">
            {contenido.miniaturaUrl ? <Image source={{ uri: contenido.miniaturaUrl }} style={styles.foto} accessibilityLabel={`Foto de ${contenido.nombre}`} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.datoFuerte}>{contenido.nombre} · {formatoPesos(contenido.precio)} / {contenido.unidad}</Text>
              <Text style={styles.dato}>{contenido.municipio} · estado {contenido.estado.toLowerCase()}</Text>
              {contenido.descripcion ? <Text style={styles.dato}>{contenido.descripcion}</Text> : null}
            </View>
          </View>
        ) : null}
        {contenido && contenido.tipo === 'CALIFICACION' ? (
          <Text style={styles.dato}>{'★'.repeat(contenido.puntuacion)} “{contenido.comentario || '(sin texto)'}”{contenido.oculta ? ' · oculto' : ''}</Text>
        ) : null}
        {contenido && contenido.tipo === 'PEDIDO' ? (
          <Text style={styles.dato}>Pedido N.º {contenido.id.slice(0, 8).toUpperCase()} · {contenido.estado.toLowerCase()} · {formatoPesos(contenido.total)}{contenido.motivoCancelacion ? ` · ${contenido.motivoCancelacion}` : ''}</Text>
        ) : null}
      </Seccion>

      {reportado ? (
        <Seccion titulo={`Usuario reportado: ${reportado.nombres} ${reportado.apellidos}`}>
          <Historial u={reportado} />
          <BotonGrande titulo="Ver usuario" variante="secundario" onPress={() => router.push(`/administrador/usuario/${reportado.id}`)} />
        </Seccion>
      ) : null}
      <Seccion titulo={`Reportante: ${reportante.nombres} ${reportante.apellidos}`}>
        <Text style={styles.dato}>Reportes hechos: {reportante.historial.reportesHechos} · malintencionados: {reportante.historial.reportesMalintencionados}</Text>
      </Seccion>

      {abierto ? (
        <Seccion titulo="Decisión">
          <Opciones opciones={d.decisionesPosibles.map((x) => ({ valor: x, ...DECISIONES[x] }))} valor={decision} onCambiar={setDecision} error={errores.decision} />
          {decision === 'DESESTIMAR' ? (
            <Opciones etiqueta="¿El reporte fue malintencionado?" opciones={[{ valor: 'no', texto: 'No' }, { valor: 'si', texto: 'Sí, advertir al reportante' }]} valor={malintencionado} onCambiar={setMalintencionado} />
          ) : null}
          <CampoTexto etiqueta="Explicación para los usuarios" value={resolucion} onChangeText={setResolucion} error={errores.resolucion} multiline maxLength={300} />
          {confirmacion ? (
            <Aviso mensaje={confirmacion} testID="confirmar-suspension">
              <BotonGrande titulo="Confirmar suspensión" onPress={() => resolver(true)} deshabilitado={enviando} />
              <BotonGrande titulo="Volver" variante="secundario" onPress={() => setConfirmacion(null)} />
            </Aviso>
          ) : (
            <BotonGrande titulo={enviando ? 'Guardando…' : 'Registrar decisión'} onPress={() => resolver(false)} deshabilitado={enviando} />
          )}
        </Seccion>
      ) : (
        <Seccion titulo="Resultado">
          <Text style={styles.dato} testID="resultado-reporte">{reporte.decision} · {reporte.resolucion}</Text>
        </Seccion>
      )}
    </ScrollView>
  );
}

function Historial({ u }) {
  const h = u.historial;
  return (
    <View>
      <Text style={styles.dato}>{u.rol === 'PRODUCTOR' ? 'Productor' : 'Consumidor'}{u.verificado ? ' ✔ verificado' : ''} · {u.municipio} · cuenta {u.estado.toLowerCase()} · desde {fechaCorta(u.fechaRegistro)}</Text>
      <Text style={styles.dato}>Reportes recibidos: {h.reportesRecibidos} (confirmados {h.reportesConfirmados})</Text>
      <Text style={styles.dato}>Pedidos: {h.pedidosEntregados} entregados · {h.pedidosCancelados} cancelados · {h.pedidosEnCurso} en curso</Text>
      {h.calificacion ? <Text style={styles.dato}>Calificación: ★ {String(h.calificacion.promedio).replace('.', ',')} ({h.calificacion.total})</Text> : null}
    </View>
  );
}

function Seccion({ titulo, children }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl, maxWidth: 960, width: '100%', alignSelf: 'center' },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  sub: { fontSize: texto.pequeno, color: colores.textoSecundario },
  cita: { fontSize: texto.base, fontStyle: 'italic', color: colores.texto, marginVertical: espacio.s },
  seccion: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginTop: espacio.m },
  seccionTitulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto, marginBottom: espacio.xs },
  filaContenido: { flexDirection: 'row', gap: espacio.m },
  foto: { width: 96, height: 96, borderRadius: 8 },
  dato: { fontSize: texto.pequeno, color: colores.texto, marginVertical: 2 },
  datoFuerte: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
});
