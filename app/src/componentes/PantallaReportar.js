import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { BotonGrande } from './BotonGrande';
import { CampoTexto } from './CampoTexto';
import { Opciones } from './Opciones';
import { Aviso } from './Aviso';
import { api } from '../api/cliente';
import { useConexion } from '../hooks/useConexion';
import { useSincronizacion } from '../sync/SincronizacionContext';
import { MOTIVOS_REPORTE } from '../datos/fase2';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const QUE = { PRODUCTO: 'la publicación', CALIFICACION: 'el comentario', PEDIDO: 'el pedido' };

/**
 * CU-19 · Reportar contenido o incumplimiento (RF-19).
 * Parámetros: tipo (PRODUCTO | CALIFICACION | PEDIDO), id y titulo (lo que se reporta).
 * A1 reporte repetido → "ya está en trámite" · A2 «Otro» exige descripción · A3 sin señal se guarda y se envía al reconectar.
 */
export function PantallaReportar() {
  const { tipo, id, titulo } = useLocalSearchParams();
  const router = useRouter();
  const { enLinea } = useConexion();
  const sync = useSincronizacion();
  const [motivo, setMotivo] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [hecho, setHecho] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const opciones = MOTIVOS_REPORTE.filter((m) => m.para.includes(tipo));

  async function enviar() {
    const e = {};
    if (!motivo) e.motivo = 'Elija un motivo.';
    if (motivo === 'OTRO' && descripcion.trim().length < 10) e.descripcion = 'Cuéntenos qué pasó (mínimo 10 caracteres).';
    setErrores(e);
    setAviso(null);
    if (Object.keys(e).length) return;
    const reporte = { tipoContenido: tipo, idContenido: id, motivo, descripcion: descripcion.trim() || undefined };
    setEnviando(true);
    try {
      if (!enLinea) throw Object.assign(new Error('sin señal'), { codigo: 'SIN_CONEXION' });
      await api.reportar(reporte);
      setHecho(true);
      setAviso({ tipo: 'info', mensaje: '✓ Recibimos su reporte. La asociación lo revisará y le avisaremos el resultado.' });
    } catch (err) {
      if (err.codigo === 'SIN_CONEXION') {
        await sync.reporteDespues(Crypto.randomUUID(), reporte);
        setHecho(true);
        setAviso({ tipo: 'sinSenal', mensaje: '✓ Reporte guardado en el teléfono. Se enviará solo cuando vuelva la señal.' });
      } else if (err.codigo === 'REPORTE_EN_TRAMITE') {
        setHecho(true);
        setAviso({ tipo: 'info', mensaje: err.message });
      } else if (err.detalles && err.detalles.campos) {
        setErrores(err.detalles.campos);
      } else {
        setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo} accessibilityRole="header">Reportar {QUE[tipo] || 'contenido'}</Text>
        {titulo ? <Text style={styles.sub}>{titulo}</Text> : null}
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-reporte" /> : null}
        {hecho ? (
          <BotonGrande titulo="Volver" onPress={() => router.back()} />
        ) : (
          <>
            <Opciones etiqueta="¿Qué pasó?" opciones={opciones} valor={motivo} onCambiar={setMotivo} error={errores.motivo} />
            <CampoTexto
              etiqueta={motivo === 'OTRO' ? 'Cuéntenos qué pasó' : 'Detalles (opcional)'}
              value={descripcion}
              onChangeText={setDescripcion}
              error={errores.descripcion}
              multiline
              maxLength={500}
            />
            <Text style={styles.ayuda}>Su reporte es confidencial: la otra persona no sabe quién lo hizo.</Text>
            <BotonGrande titulo={enviando ? 'Enviando…' : 'Enviar reporte'} onPress={enviar} deshabilitado={enviando} />
            <BotonGrande titulo="Cancelar" variante="secundario" onPress={() => router.back()} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  sub: { fontSize: texto.base, color: colores.textoSecundario, marginBottom: espacio.m },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.m },
});
