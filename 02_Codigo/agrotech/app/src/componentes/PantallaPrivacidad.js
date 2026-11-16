import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BotonGrande } from './BotonGrande';
import { CampoTexto } from './CampoTexto';
import { Aviso } from './Aviso';
import { api } from '../api/cliente';
import { useBase } from '../hooks/useBase';
import { useSesion } from '../sesion/SesionContext';
import { fechaCorta } from './TarjetaPedido';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const ESTADOS = { PENDIENTE: 'En trámite', APLAZADA: 'Aplazada (pedidos en curso)', COMPLETADA: 'Completada', DESISTIDA: 'Desistida' };

/**
 * CU-20 · Privacidad y datos (RF-20 · Ley 1581 de 2012).
 * Paso 1 consultar datos y autorización · paso 2 corregir (Mi perfil) o pedir la supresión ·
 * paso 3 consecuencias y plazo · A1 se aplaza con pedidos en curso · A2 desistir.
 */
export function PantallaPrivacidad() {
  const router = useRouter();
  const base = useBase();
  const { cerrarSesion } = useSesion();
  const [info, setInfo] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    api.privacidad().then(setInfo).catch((err) => setAviso({ tipo: err.codigo === 'SIN_CONEXION' ? 'sinSenal' : 'error', mensaje: mensajeDeError(err) }));
  }, []);
  useFocusEffect(cargar);

  if (!info) return <View style={styles.centro}>{aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;

  const { datos, autorizaciones, finalidades, supresion } = info;
  const s = supresion.solicitud;
  const abierta = s && ['PENDIENTE', 'APLAZADA'].includes(s.estado);

  async function solicitar() {
    setEnviando(true);
    setAviso(null);
    try {
      const r = await api.solicitarSupresion(motivo.trim() || undefined);
      if (r.sesionCerrada) {
        setAviso({ tipo: 'info', mensaje: 'Sus datos fueron suprimidos. Se cerrará la sesión.' });
        setTimeout(() => cerrarSesion(), 1500);
        return;
      }
      setConfirmando(false);
      setAviso({ tipo: 'sinSenal', mensaje: `Solicitud registrada y aplazada: ${r.solicitud.observacion} Fecha límite: ${r.solicitud.fechaLimite}.` });
      cargar();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  async function desistir() {
    setEnviando(true);
    try {
      await api.desistirSupresion();
      setAviso({ tipo: 'info', mensaje: '✓ Cancelamos su solicitud. Su cuenta sigue activa.' });
      cargar();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-privacidad" /> : null}
      <Text style={styles.titulo} accessibilityRole="header">Sus datos en AgroTech</Text>
      <View style={styles.caja} testID="mis-datos">
        <Dato etiqueta="Nombre" valor={`${datos.nombres} ${datos.apellidos}`} />
        <Dato etiqueta="Correo" valor={datos.correo} />
        <Dato etiqueta="Celular" valor={datos.telefono} />
        <Dato etiqueta="Municipio" valor={`${datos.municipio}${datos.veredaDireccion ? ` · ${datos.veredaDireccion}` : ''}`} />
        <Dato etiqueta="Ubicación" valor={datos.ubicacion ? (datos.ubicacion.origen === 'TELEFONO' ? 'Punto del teléfono' : 'Cabecera municipal') : 'No guardada'} />
        <BotonGrande titulo="Corregir mis datos" variante="secundario" onPress={() => router.push(`${base}/perfil`)} />
      </View>

      <Text style={styles.subtitulo}>Para qué los usamos</Text>
      {finalidades.map((f) => <Text key={f.dato} style={styles.item}>• <Text style={styles.negrita}>{f.dato}:</Text> {f.finalidad}</Text>)}

      <Text style={styles.subtitulo}>Autorización otorgada</Text>
      {autorizaciones.map((a) => (
        <Text key={`${a.version}-${a.fecha}`} style={styles.item} testID="autorizacion">✓ Aviso de privacidad versión {a.version} · aceptado el {fechaCorta(a.fecha)} ({a.canal === 'APP' ? 'en la app' : a.canal})</Text>
      ))}

      <Text style={styles.subtitulo}>Borrar mis datos</Text>
      {s ? <Aviso tipo={abierta ? 'sinSenal' : 'info'} mensaje={`Solicitud del ${fechaCorta(s.fechaSolicitud)}: ${ESTADOS[s.estado]}. ${s.observacion || ''} Fecha límite legal: ${s.fechaLimite}.`} testID="estado-supresion" /> : null}
      {abierta ? (
        <BotonGrande titulo="Desistir de la solicitud" variante="secundario" onPress={desistir} deshabilitado={enviando} />
      ) : confirmando ? (
        <View style={styles.peligro} testID="confirmar-supresion">
          <Text style={styles.negrita}>Antes de continuar, tenga en cuenta:</Text>
          {supresion.consecuencias.map((c) => <Text key={c} style={styles.item}>• {c}</Text>)}
          <Text style={styles.item}>Responderemos a más tardar en {supresion.plazoDiasHabiles} días hábiles.</Text>
          <CampoTexto etiqueta="Motivo (opcional)" value={motivo} onChangeText={setMotivo} maxLength={300} />
          <BotonGrande titulo={enviando ? 'Enviando…' : 'Sí, borrar mis datos'} onPress={solicitar} deshabilitado={enviando} />
          <BotonGrande titulo="No, volver" variante="secundario" onPress={() => setConfirmando(false)} />
        </View>
      ) : (
        <BotonGrande titulo="Solicitar que borren mis datos" variante="secundario" onPress={() => setConfirmando(true)} />
      )}
    </ScrollView>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <View style={styles.dato} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto, marginBottom: espacio.s },
  subtitulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto, marginTop: espacio.l, marginBottom: espacio.xs },
  caja: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m },
  peligro: { borderWidth: 2, borderColor: colores.error, borderRadius: 12, padding: espacio.m },
  item: { fontSize: texto.pequeno, color: colores.texto, marginVertical: 2, lineHeight: 20 },
  negrita: { fontWeight: '800', fontSize: texto.pequeno, color: colores.texto },
  dato: { marginBottom: espacio.s },
  datoEtiqueta: { fontSize: 12, color: colores.textoSecundario },
  datoValor: { fontSize: texto.base, color: colores.texto },
});
