import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { Cantidad } from '../../../componentes/Cantidad';
import { Aviso } from '../../../componentes/Aviso';
import { EstadoProducto, FotoProducto } from '../../../componentes/TarjetaProducto';
import { api } from '../../../api/cliente';
import { unidad as datosUnidad } from '../../../datos/catalogo';
import { useConexion } from '../../../hooks/useConexion';
import { formatoCantidad, formatoPesos, leerNumero } from '../../../utilidades/formato';
import { errorCantidad, errorPrecio } from '../../../validacion/producto';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

/**
 * CU-10 / RF-10a · Corregir precio y cantidad de una publicación propia.
 * Envía la versión leída: si otra edición ganó primero (409) se cargan los datos vigentes (CP-17).
 */
export default function EditarProducto() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { enLinea } = useConexion();
  const [producto, setProducto] = useState(null);
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const mostrar = (p) => {
    setProducto(p);
    setPrecio(String(p.precio));
    setCantidad(formatoCantidad(p.stock));
  };

  useEffect(() => {
    api.producto(id).then((r) => mostrar(r.producto)).catch((err) => setAviso({ tipo: 'error', mensaje: mensajeDeError(err) }));
  }, [id]);

  async function guardar() {
    const e = {};
    const errP = errorPrecio(precio);
    const errC = errorCantidad(cantidad, { permitirCero: true });
    if (errP) e.precio = errP;
    if (errC) e.stock = errC;
    setErrores(e);
    setAviso(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const r = await api.editarProducto(id, {
        precio: leerNumero(precio),
        stock: leerNumero(cantidad, { decimales: true }),
        version: producto.version,
      });
      mostrar(r.producto);
      setAviso({
        tipo: 'info',
        mensaje: r.producto.estado === 'AGOTADA'
          ? '✓ Guardado. Con cantidad 0 la publicación queda Agotada y sale del catálogo.'
          : '✓ Guardado. El catálogo ya muestra el nuevo precio y la cantidad.',
      });
    } catch (err) {
      if (err.codigo === 'CONFLICTO_VERSION' && err.detalles && err.detalles.producto) {
        mostrar(err.detalles.producto);
        setAviso({ tipo: 'sinSenal', mensaje: `${err.message} Ahora ve los datos actuales.` });
      } else {
        setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!producto) {
    return (
      <View style={styles.centro}>
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}
      </View>
    );
  }

  const u = datosUnidad(producto.unidad);
  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.cabecera}>
          <FotoProducto uri={producto.miniaturaUrl} codigoCategoria={producto.categoria} style={styles.foto} />
          <View style={styles.cabeceraTexto}>
            <Text style={styles.nombre}>{producto.nombre}</Text>
            <Text style={styles.actual}>{formatoPesos(producto.precio)} / {u.nombre} · {formatoCantidad(producto.stock)} {u.plural}</Text>
            <EstadoProducto estado={producto.estado} />
          </View>
        </View>

        {!enLinea ? <Aviso tipo="sinSenal" mensaje="Sin señal. Para guardar cambios necesita conexión." /> : null}
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-editar" /> : null}

        <Cantidad etiqueta="Cantidad disponible" valor={cantidad} onCambiar={setCantidad} error={errores.stock} minimo={0} sufijo={u.plural} />
        <Text style={styles.ayuda}>Si ya no tiene, ponga 0: la publicación queda Agotada.</Text>
        <CampoTexto
          etiqueta={`Precio por ${u.singular}`}
          value={precio}
          onChangeText={(t) => setPrecio(t.replace(/[^\d.]/g, ''))}
          error={errores.precio}
          keyboardType="number-pad"
          ayuda="Los pedidos ya hechos conservan el precio con el que se pidieron."
        />
        <BotonGrande titulo={enviando ? 'Guardando…' : 'Guardar cambios'} onPress={guardar} deshabilitado={enviando || !enLinea} />
        <BotonGrande titulo="Volver a mis productos" variante="secundario" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m },
  cabecera: { flexDirection: 'row', gap: espacio.m, marginBottom: espacio.m },
  foto: { width: 96, height: 96, borderRadius: 12 },
  cabeceraTexto: { flex: 1, justifyContent: 'center' },
  nombre: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  actual: { fontSize: texto.pequeno, color: colores.textoSecundario, marginVertical: 2 },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: -espacio.s, marginBottom: espacio.m },
});
