import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { BotonGrande } from '../../componentes/BotonGrande';
import { CampoTexto } from '../../componentes/CampoTexto';
import { Cantidad } from '../../componentes/Cantidad';
import { Opciones } from '../../componentes/Opciones';
import { Aviso } from '../../componentes/Aviso';
import { SelectorMunicipio } from '../../componentes/SelectorMunicipio';
import { api } from '../../api/cliente';
import { CATEGORIAS, PRODUCTOS_FRECUENTES, UNIDADES, unidad as datosUnidad } from '../../datos/catalogo';
import { ErrorFoto, obtenerFoto } from '../../fotos/prepararFoto';
import { useSesion } from '../../sesion/SesionContext';
import { useConexion } from '../../hooks/useConexion';
import { formatoPesos, leerNumero } from '../../utilidades/formato';
import { validarPublicacion } from '../../validacion/producto';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

/**
 * CU-02 · Publicar un producto (wireframe 2, a un toque desde el inicio).
 * Foto → qué vende → cuánto y cómo → precio → Publicar. El municipio sale del perfil.
 * El id se genera en el teléfono una sola vez: si la red falla y se reintenta, la API no duplica (A3).
 */
export default function Publicar() {
  const router = useRouter();
  const { usuario } = useSesion();
  const { enLinea } = useConexion();
  const scrollRef = useRef(null);
  const idRef = useRef(Crypto.randomUUID());

  const [fotos, setFotos] = useState(null);
  const [form, setForm] = useState({
    nombre: '', categoria: null, unidad: null, cantidad: '1', precio: '', descripcion: '', municipio: usuario.municipio,
  });
  const [cambiarMunicipio, setCambiarMunicipio] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const u = form.unidad ? datosUnidad(form.unidad) : null;
  const precioNum = leerNumero(form.precio);

  const cambiar = (campo) => (valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    const clave = campo === 'cantidad' ? 'stock' : campo;
    if (errores[clave]) setErrores((e) => ({ ...e, [clave]: undefined }));
  };

  const elegirFrecuente = (nombre) => {
    const p = PRODUCTOS_FRECUENTES.find((x) => x.nombre === nombre);
    setForm((f) => ({ ...f, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad }));
    setErrores((e) => ({ ...e, nombre: undefined, categoria: undefined, unidad: undefined }));
  };

  async function foto(origen) {
    try {
      const r = await obtenerFoto(origen);
      if (r) {
        setFotos(r);
        setErrores((e) => ({ ...e, foto: undefined }));
      }
    } catch (err) {
      setErrores((e) => ({ ...e, foto: err instanceof ErrorFoto ? err.message : 'No se pudo preparar la foto. Intente de nuevo.' }));
    }
  }

  async function publicar() {
    const e = validarPublicacion({ ...form, fotos });
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length) {
      setErrorGeneral('Falta información. Revise lo marcado en rojo.');
      scrollRef.current && scrollRef.current.scrollTo({ y: 0, animated: true });
      return;
    }
    setEnviando(true);
    try {
      await api.publicarProducto({
        id: idRef.current,
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        unidad: form.unidad,
        stock: leerNumero(form.cantidad, { decimales: true }),
        precio: precioNum,
        descripcion: form.descripcion.trim() || undefined,
        municipio: form.municipio,
      }, fotos);
      router.replace({ pathname: '/productor/productos', params: { publicado: form.nombre.trim() } });
    } catch (err) {
      if (err.codigo === 'DATOS_INVALIDOS' && err.detalles && err.detalles.campos) setErrores(err.detalles.campos);
      if (err.codigo === 'FOTO_MUY_GRANDE') setErrores({ foto: 'La foto quedó muy pesada. Tome otra con menos detalle.' });
      setErrorGeneral(err.codigo === 'SIN_CONEXION'
        ? 'No se pudo enviar por falta de señal. Sus datos y la foto siguen aquí: pulse Publicar de nuevo cuando tenga conexión.'
        : mensajeDeError(err));
      setEnviando(false);
      scrollRef.current && scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {!enLinea ? <Aviso tipo="sinSenal" mensaje="Sin señal. Puede llenar todo; para publicar necesita conexión." /> : null}
        {errorGeneral ? <Aviso mensaje={errorGeneral} testID="error-publicar" /> : null}

        <Text style={styles.seccion}>1. Foto</Text>
        {fotos ? (
          <View>
            <Image source={{ uri: fotos.foto.uri }} style={styles.vistaPrevia} accessibilityLabel="Foto del producto" />
            <View style={styles.filaFoto}>
              <View style={styles.mitad}><BotonGrande titulo="📷 Otra foto" variante="secundario" onPress={() => foto('camara')} /></View>
              <View style={styles.mitad}><BotonGrande titulo="🖼️ Galería" variante="secundario" onPress={() => foto('galeria')} /></View>
            </View>
          </View>
        ) : (
          <View style={styles.filaFoto}>
            <Pressable accessibilityRole="button" accessibilityLabel="Tomar foto" onPress={() => foto('camara')} style={[styles.botonFoto, errores.foto && styles.botonFotoError]}>
              <Text style={styles.iconoFoto} importantForAccessibility="no">📷</Text>
              <Text style={styles.textoFoto}>Tomar foto</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Elegir de la galería" onPress={() => foto('galeria')} style={[styles.botonFoto, errores.foto && styles.botonFotoError]}>
              <Text style={styles.iconoFoto} importantForAccessibility="no">🖼️</Text>
              <Text style={styles.textoFoto}>De la galería</Text>
            </Pressable>
          </View>
        )}
        {errores.foto ? <Text style={styles.error}>{errores.foto}</Text> : null}

        <Text style={styles.seccion}>2. ¿Qué va a vender?</Text>
        <Opciones
          opciones={PRODUCTOS_FRECUENTES.map((p) => ({ valor: p.nombre, texto: p.nombre }))}
          valor={PRODUCTOS_FRECUENTES.some((p) => p.nombre === form.nombre) ? form.nombre : null}
          onCambiar={elegirFrecuente}
        />
        <CampoTexto etiqueta="Nombre del producto" value={form.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} placeholder="Ej.: Papa pastusa" autoCapitalize="sentences" />
        <Opciones etiqueta="Categoría" opciones={CATEGORIAS.map((c) => ({ valor: c.codigo, texto: c.nombre, icono: c.icono }))} valor={form.categoria} onCambiar={cambiar('categoria')} error={errores.categoria} />

        <Text style={styles.seccion}>3. ¿Cuánto tiene?</Text>
        <Opciones etiqueta="Lo vende por" opciones={UNIDADES.map((x) => ({ valor: x.codigo, texto: x.nombre }))} valor={form.unidad} onCambiar={cambiar('unidad')} error={errores.unidad} />
        <Cantidad etiqueta="Cantidad disponible" valor={form.cantidad} onCambiar={cambiar('cantidad')} error={errores.stock} minimo={0} sufijo={u ? u.plural : ''} />

        <Text style={styles.seccion}>4. Precio</Text>
        <CampoTexto
          etiqueta={u ? `Precio por ${u.singular}` : 'Precio por unidad'}
          value={form.precio}
          onChangeText={(t) => cambiar('precio')(t.replace(/[^\d.]/g, ''))}
          error={errores.precio}
          keyboardType="number-pad"
          placeholder="Ej.: 85000"
          ayuda={Number.isInteger(precioNum) && precioNum > 0 ? `Se mostrará como ${formatoPesos(precioNum)}` : 'En pesos, sin centavos.'}
        />
        <CampoTexto etiqueta="Descripción (opcional)" value={form.descripcion} onChangeText={cambiar('descripcion')} error={errores.descripcion} multiline placeholder="Ej.: Cosecha de esta semana, lavada" />

        {cambiarMunicipio ? (
          <SelectorMunicipio valor={form.municipio} onCambiar={cambiar('municipio')} error={errores.municipio} />
        ) : (
          <View style={styles.municipio}>
            <Text style={styles.municipioTexto}>📍 {form.municipio} <Text style={styles.deperfil}>(de su perfil)</Text></Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cambiar municipio" onPress={() => setCambiarMunicipio(true)} style={styles.enlace}>
              <Text style={styles.enlaceTexto}>Cambiar</Text>
            </Pressable>
          </View>
        )}

        <BotonGrande titulo={enviando ? 'Publicando…' : 'Publicar'} onPress={publicar} deshabilitado={enviando || !enLinea} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  seccion: { fontSize: texto.titulo, fontWeight: '800', color: colores.primario, marginTop: espacio.m, marginBottom: espacio.s },
  filaFoto: { flexDirection: 'row', gap: espacio.m },
  mitad: { flex: 1 },
  botonFoto: {
    flex: 1, minHeight: 120, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colores.primario,
    backgroundColor: colores.primarioClaro, alignItems: 'center', justifyContent: 'center', padding: espacio.s,
  },
  botonFotoError: { borderColor: colores.error },
  iconoFoto: { fontSize: 40 },
  textoFoto: { fontSize: texto.base, fontWeight: '700', color: colores.primario, marginTop: espacio.xs },
  vistaPrevia: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: colores.superficie },
  error: { fontSize: texto.pequeno, color: colores.error, fontWeight: '600', marginTop: espacio.xs },
  municipio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espacio.m },
  municipioTexto: { fontSize: texto.base, fontWeight: '700', color: colores.texto, flex: 1 },
  deperfil: { fontWeight: '400', color: colores.textoSecundario },
  enlace: { minHeight: 48, justifyContent: 'center', paddingLeft: espacio.m },
  enlaceTexto: { fontSize: texto.base, fontWeight: '700', color: colores.primario, textDecorationLine: 'underline' },
});
