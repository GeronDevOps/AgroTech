import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Aviso } from './Aviso';
import { AvisoSinSenal } from './AvisoSinSenal';
import { api } from '../api/cliente';
import { guardarMensajes, mensajesLocal, pedidoLocal } from '../local/cache';
import { useConexion } from '../hooks/useConexion';
import { useSesion } from '../sesion/SesionContext';
import { useSincronizacion } from '../sync/SincronizacionContext';
import { useTiempoReal } from '../tiempoReal/TiempoRealContext';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto, toque } from '../tema/tema';

export const MAX_CARACTERES = 500;
const CERRADOS = ['ENTREGADO', 'CANCELADO'];
const hora = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Une el historial del servidor con lo que sigue en la cola del teléfono, sin repetir, en orden de fecha. */
function unir(servidor, ops, idPedido, idUsuario) {
  const ids = new Set(servidor.map((m) => m.id));
  const enCola = ops
    .filter((o) => o.entidad === 'MENSAJE' && o.payload.idPedido === idPedido && !ids.has(o.idEntidad))
    .map((o) => ({ id: o.idEntidad, idPedido, idEmisor: idUsuario, contenido: o.payload.contenido, fecha: o.creadoEn, leido: false, cola: o.estado, error: o.error }));
  return [...servidor, ...enCola].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/**
 * CU-05 · Chat sobre un pedido (wireframe 5). Mismo componente para productor y consumidor.
 * - Historial del servidor (o del teléfono sin señal); mensajes nuevos en tiempo real por WebSocket (CA-09).
 * - Sin señal el mensaje queda "⏳ Pendiente" y se reenvía solo, con el mismo id (A1).
 * - Al abrir se marcan leídos los recibidos; el emisor ve "✓✓ Leído" (paso 4).
 * - Pedido entregado o cancelado: solo lectura (A2). Vacío o más de 500 caracteres: no se envía (A3).
 */
export function PantallaChat({ idPedido }) {
  const { usuario } = useSesion();
  const { enLinea } = useConexion();
  const sync = useSincronizacion();
  const { operaciones, version: versionSync } = sync;
  const { suscribir } = useTiempoReal();
  const [servidor, setServidor] = useState(null);
  const [ops, setOps] = useState([]);
  const [pedido, setPedido] = useState(null);
  const [abierto, setAbierto] = useState(true);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError] = useState(null);
  const [borrador, setBorrador] = useState('');
  const scroll = useRef(null);
  const enFoco = useRef(false);

  const marcarLeidos = useCallback(() => { api.marcarLeidos(idPedido).catch(() => {}); }, [idPedido]);

  const cargar = useCallback(async () => {
    const p = await api.pedido(idPedido).then((r) => r.pedido).catch(() => pedidoLocal(idPedido).catch(() => null));
    if (p) setPedido(p);
    try {
      const r = await api.mensajes(idPedido);
      setServidor(r.mensajes);
      setAbierto(r.abierto);
      setDesdeCache(false);
      setError(null);
      guardarMensajes(r.mensajes).catch(() => {});
      if (r.mensajes.some((m) => m.idEmisor !== usuario.id && !m.leido)) marcarLeidos();
    } catch (err) {
      if (err.codigo === 'SIN_CONEXION') {
        setServidor(await mensajesLocal(idPedido).catch(() => []));
        setDesdeCache(true);
        if (p) setAbierto(!CERRADOS.includes(p.estado));
      } else {
        setError(mensajeDeError(err));
        setServidor([]);
      }
    }
    setOps(await operaciones().catch(() => []));
  }, [idPedido, usuario.id, operaciones, marcarLeidos]);

  // Al abrir, al volver a la pantalla y al terminar cada sincronización (los ⏳ pasan a enviados).
  useFocusEffect(useCallback(() => {
    enFoco.current = true;
    cargar();
    return () => { enFoco.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionSync solo dispara la recarga
  }, [cargar, versionSync]));

  // Tiempo real: mensajes nuevos y confirmaciones de lectura de este pedido.
  useEffect(() => suscribir((e) => {
    if (e.tipo === 'mensaje' && e.mensaje.idPedido === idPedido) {
      setServidor((lista) => (lista && !lista.some((m) => m.id === e.mensaje.id) ? [...lista, e.mensaje] : lista));
      guardarMensajes([e.mensaje]).catch(() => {});
      if (e.mensaje.idEmisor !== usuario.id && enFoco.current) marcarLeidos();
    }
    if (e.tipo === 'mensajes_leidos' && e.idPedido === idPedido && e.idLector !== usuario.id) {
      const leidos = new Set(e.ids);
      setServidor((lista) => lista && lista.map((m) => (leidos.has(m.id) ? { ...m, leido: true } : m)));
    }
    if (e.tipo === 'pedido_actualizado' && e.idPedido === idPedido && CERRADOS.includes(e.estado)) setAbierto(false);
  }), [suscribir, idPedido, usuario.id, marcarLeidos]);

  const mensajes = useMemo(() => (servidor ? unir(servidor, ops, idPedido, usuario.id) : null), [servidor, ops, idPedido, usuario.id]);

  async function enviar() {
    const contenido = borrador.trim();
    if (!contenido || contenido.length > MAX_CARACTERES) return;
    const mensaje = { id: Crypto.randomUUID(), contenido };
    setBorrador('');
    const aCola = async () => {
      await sync.mensajeDespues(idPedido, mensaje);
      setOps(await operaciones());
    };
    if (!enLinea) return aCola();
    try {
      const r = await api.enviarMensaje(idPedido, mensaje);
      setServidor((lista) => (lista.some((m) => m.id === r.mensaje.id) ? lista : [...lista, r.mensaje]));
      guardarMensajes([r.mensaje]).catch(() => {});
    } catch (err) {
      if (err.codigo === 'SIN_CONEXION') return aCola();
      if (err.codigo === 'CHAT_CERRADO') setAbierto(false);
      setError(mensajeDeError(err));
      setBorrador(contenido);
    }
    return undefined;
  }

  if (!mensajes) {
    return <View style={styles.centro}><ActivityIndicator size="large" color={colores.primario} /></View>;
  }

  const contraparte = pedido ? (pedido.consumidor.id === usuario.id ? pedido.productor.nombre : pedido.consumidor.nombre) : '';
  const restantes = MAX_CARACTERES - borrador.length;
  const puedeEnviar = borrador.trim().length > 0 && restantes >= 0;

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {desdeCache ? <View style={styles.franja}><AvisoSinSenal detalle="Lo que escriba se enviará al volver la señal." /></View> : null}
      {error ? <View style={styles.franja}><Aviso mensaje={error} testID="error-chat" /></View> : null}
      <ScrollView
        ref={scroll}
        style={styles.lista}
        contentContainerStyle={styles.listaContenido}
        onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: false })}
        accessibilityLabel={`Conversación con ${contraparte}`}
      >
        <Text style={styles.privacidad}>🔒 Acuerden aquí la entrega. No hace falta compartir su teléfono.</Text>
        {!mensajes.length ? <Text style={styles.vacio} testID="chat-vacio">Aún no hay mensajes. Escriba el primero.</Text> : null}
        {mensajes.map((m) => <Burbuja key={m.id} mensaje={m} propio={m.idEmisor === usuario.id} contraparte={contraparte} />)}
      </ScrollView>

      {abierto ? (
        <View style={styles.redactar}>
          <View style={styles.campoCaja}>
            <TextInput
              accessibilityLabel="Escriba un mensaje"
              value={borrador}
              onChangeText={setBorrador}
              placeholder="Escriba un mensaje"
              placeholderTextColor={colores.textoSecundario}
              multiline
              style={styles.campo}
            />
            {restantes < 100 ? <Text style={[styles.contador, restantes < 0 && styles.contadorError]}>{restantes < 0 ? `Sobran ${-restantes} caracteres` : `Quedan ${restantes}`}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !puedeEnviar }}
            disabled={!puedeEnviar}
            onPress={enviar}
            style={({ pressed }) => [styles.enviar, !puedeEnviar && styles.enviarInactivo, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.enviarTexto}>➤</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cerrado} testID="chat-cerrado">
          <Text style={styles.cerradoTexto}>🔒 El pedido terminó: el chat quedó en solo lectura.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Burbuja({ mensaje: m, propio, contraparte }) {
  let estado = '';
  if (propio) {
    if (m.cola === 'CON_ERROR') estado = ` · ⚠ No se envió: ${m.error ? m.error.mensaje : ''}`;
    else if (m.cola) estado = ' · ⏳ Pendiente';
    else estado = m.leido ? ' · ✓✓ Leído' : ' · ✓ Enviado';
  }
  return (
    <View
      style={[styles.burbuja, propio ? styles.propia : styles.ajena]}
      accessibilityLabel={`${propio ? 'Usted' : contraparte}, ${hora(m.fecha)}: ${m.contenido}${estado}`}
      testID={propio ? 'mensaje-propio' : 'mensaje-ajeno'}
    >
      <Text style={styles.burbujaTexto}>{m.contenido}</Text>
      <Text style={styles.burbujaPie}>{hora(m.fecha)}{estado}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.superficie },
  centro: { flex: 1, justifyContent: 'center', backgroundColor: colores.fondo },
  franja: { paddingHorizontal: espacio.m, paddingTop: espacio.s },
  lista: { flex: 1 },
  listaContenido: { padding: espacio.m, gap: espacio.s },
  privacidad: { fontSize: texto.pequeno, color: colores.textoSecundario, textAlign: 'center', marginBottom: espacio.s },
  vacio: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center', marginTop: espacio.l },
  burbuja: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  propia: { alignSelf: 'flex-end', backgroundColor: colores.enLinea, borderBottomRightRadius: 4 },
  ajena: { alignSelf: 'flex-start', backgroundColor: colores.fondo, borderWidth: 1, borderColor: colores.borde, borderBottomLeftRadius: 4 },
  burbujaTexto: { fontSize: texto.base, color: colores.texto },
  burbujaPie: { fontSize: 12, color: colores.textoSecundario, marginTop: 2, textAlign: 'right' },
  redactar: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s, padding: espacio.s, backgroundColor: colores.fondo, borderTopWidth: 1, borderTopColor: colores.borde },
  campoCaja: { flex: 1, minWidth: 0 },
  campo: {
    minHeight: toque.boton, maxHeight: 140, borderWidth: 2, borderColor: colores.borde, borderRadius: 12,
    paddingHorizontal: espacio.m, paddingVertical: espacio.s, fontSize: texto.base, color: colores.texto,
  },
  contador: { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  contadorError: { color: colores.error, fontWeight: '700' },
  enviar: { width: toque.boton, height: toque.boton, borderRadius: 28, backgroundColor: colores.primario, alignItems: 'center', justifyContent: 'center' },
  enviarInactivo: { backgroundColor: '#BDBDBD' },
  enviarTexto: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  cerrado: { padding: espacio.m, backgroundColor: colores.fondo, borderTopWidth: 1, borderTopColor: colores.borde },
  cerradoTexto: { fontSize: texto.base, color: colores.textoSecundario, textAlign: 'center' },
});
