import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BotonGrande } from './BotonGrande';
import { CampoTexto } from './CampoTexto';
import { Aviso } from './Aviso';
import { api } from '../api/cliente';
import { useConexion } from '../hooks/useConexion';
import { useSincronizacion } from '../sync/SincronizacionContext';
import { mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto, toque } from '../tema/tema';

const TEXTOS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];
export const MAX_COMENTARIO = 300;

/** Estrellas de solo lectura: "★★★★☆ 4,5 (12)". El número siempre acompaña al símbolo (RNF-02). */
export function Estrellas({ promedio, total, tamano = texto.base }) {
  const llenas = Math.round(promedio || 0);
  return (
    <Text style={{ fontSize: tamano, color: colores.texto }} accessibilityLabel={total === 0 ? 'Sin calificaciones' : `${String(promedio).replace('.', ',')} de 5 estrellas${total !== undefined ? `, ${total} opiniones` : ''}`}>
      <Text style={{ color: '#B26A00' }}>{'★'.repeat(llenas)}</Text>
      <Text style={{ color: '#BDBDBD' }}>{'★'.repeat(5 - llenas)}</Text>
      {promedio !== undefined && promedio !== null ? ` ${String(promedio).replace('.', ',')}` : ''}
      {total !== undefined ? ` (${total})` : ''}
    </Text>
  );
}

/**
 * CU-06 · Calificar al productor (RF-06), dentro del pedido entregado.
 * Elegir estrellas es obligatorio; el comentario no. Sin señal se guarda y se sincroniza después (A3).
 * Con calificación (o en cola) se muestra en solo lectura (A2).
 */
export function CalificarPedido({ pedido, enCola, onCalificado }) {
  const { enLinea } = useConexion();
  const sync = useSincronizacion();
  const [puntuacion, setPuntuacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const hecha = pedido.calificacion || (enCola && { puntuacion: enCola.payload.puntuacion, comentario: enCola.payload.comentario });
  if (hecha) {
    return (
      <View style={styles.caja} testID="calificacion-hecha">
        <Text style={styles.titulo}>Su calificación</Text>
        <Estrellas promedio={hecha.puntuacion} tamano={texto.grande} />
        {hecha.comentario ? <Text style={styles.comentario}>“{hecha.comentario}”</Text> : null}
        {enCola ? <Text style={styles.pendiente}>⏳ Se enviará cuando haya señal.</Text> : <Text style={styles.nota}>¡Gracias! Ayuda a otros compradores.</Text>}
      </View>
    );
  }

  async function enviar() {
    if (!puntuacion) return setError('Toque las estrellas para calificar.');
    if (comentario.trim().length > MAX_COMENTARIO) return setError(`Máximo ${MAX_COMENTARIO} caracteres.`);
    setError(null);
    setEnviando(true);
    const datos = { puntuacion, ...(comentario.trim() ? { comentario: comentario.trim() } : {}) };
    try {
      if (!enLinea) {
        await sync.calificarDespues(pedido.id, datos);
      } else {
        try {
          await api.calificar(pedido.id, datos);
        } catch (err) {
          if (err.codigo !== 'SIN_CONEXION') throw err;
          await sync.calificarDespues(pedido.id, datos);
        }
      }
      onCalificado();
    } catch (err) {
      setError(mensajeDeError(err));
      if (err.codigo === 'YA_CALIFICADO') onCalificado();
    } finally {
      setEnviando(false);
    }
    return undefined;
  }

  return (
    <View style={styles.caja} testID="calificar">
      <Text style={styles.titulo}>⭐ ¿Cómo le fue con {pedido.productor.nombre}?</Text>
      <View style={styles.fila} accessibilityRole="radiogroup" accessibilityLabel="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} ${n === 1 ? 'estrella' : 'estrellas'}, ${TEXTOS[n]}`}
            accessibilityState={{ checked: puntuacion === n, selected: puntuacion === n }}
            onPress={() => { setPuntuacion(n); setError(null); }}
            style={styles.estrella}
            hitSlop={4}
          >
            <Text style={[styles.estrellaTexto, n <= puntuacion && styles.estrellaActiva]}>★</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.significado}>{puntuacion ? TEXTOS[puntuacion] : 'Toque una estrella'}</Text>
      <CampoTexto etiqueta="Comentario (opcional)" value={comentario} onChangeText={setComentario} multiline placeholder="Ej.: buena papa, llegó a tiempo" />
      {error ? <Aviso mensaje={error} testID="error-calificar" /> : null}
      <BotonGrande titulo={enviando ? 'Enviando…' : 'Enviar calificación'} onPress={enviar} deshabilitado={enviando} />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { borderWidth: 2, borderColor: '#d6b656', backgroundColor: '#FFF8E1', borderRadius: 14, padding: espacio.m, marginBottom: espacio.m },
  titulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto, marginBottom: espacio.xs },
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: espacio.xs },
  estrella: { minWidth: toque.minimo, minHeight: toque.minimo, alignItems: 'center', justifyContent: 'center' },
  estrellaTexto: { fontSize: 40, color: '#BDBDBD' },
  estrellaActiva: { color: '#B26A00' },
  significado: { fontSize: texto.base, fontWeight: '700', color: colores.texto, textAlign: 'center', marginBottom: espacio.s },
  comentario: { fontSize: texto.base, color: colores.texto, fontStyle: 'italic', marginTop: espacio.xs },
  nota: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: espacio.xs },
  pendiente: { fontSize: texto.pequeno, color: colores.sinSenalTexto, fontWeight: '700', marginTop: espacio.xs },
});
