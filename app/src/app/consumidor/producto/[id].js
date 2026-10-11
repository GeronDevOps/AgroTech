import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { Aviso } from '../../../componentes/Aviso';
import { api } from '../../../api/cliente';
import { categoria as datosCategoria, unidad as datosUnidad } from '../../../datos/catalogo';
import { formatoCantidad, formatoPesos } from '../../../utilidades/formato';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

/** CU-03 paso 3 · Detalle: foto, precio, cantidad, productor y su calificación. Agotado no se puede pedir (A3). */
export default function DetalleProducto() {
  const { id } = useLocalSearchParams();
  const [producto, setProducto] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.producto(id).then((r) => setProducto(r.producto)).catch((err) => setError(mensajeDeError(err)));
  }, [id]);

  if (!producto) {
    return (
      <View style={styles.centro}>
        {error ? <Aviso mensaje={error} /> : <ActivityIndicator size="large" color={colores.primario} />}
      </View>
    );
  }

  const u = datosUnidad(producto.unidad);
  const c = datosCategoria(producto.categoria);
  const agotado = producto.estado !== 'ACTIVA' || producto.stock <= 0;
  const { calificacion } = producto.productor;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <Image source={{ uri: producto.fotoUrl }} style={styles.foto} accessibilityLabel={`Foto de ${producto.nombre}`} resizeMode="cover" />
      <Text style={styles.categoria}>{c.icono} {c.nombre}</Text>
      <Text style={styles.nombre} accessibilityRole="header">{producto.nombre}</Text>
      <Text style={styles.precio}>{formatoPesos(producto.precio)} <Text style={styles.porUnidad}>por {u.singular}</Text></Text>

      {agotado ? <Aviso mensaje="Agotado: el productor no tiene cantidad disponible por ahora." testID="aviso-agotado" /> : null}

      <View style={styles.datos}>
        <Dato etiqueta="Disponible" valor={`${formatoCantidad(producto.stock)} ${producto.stock === 1 ? u.singular : u.plural}`} />
        <Dato etiqueta="Municipio" valor={producto.municipio} />
        <Dato etiqueta="Productor" valor={`${producto.productor.nombre}${producto.productor.verificado ? ' ✓ verificado' : ''}`} />
        <Dato
          etiqueta="Calificación"
          valor={calificacion.total ? `★ ${String(calificacion.promedio).replace('.', ',')} (${calificacion.total})` : 'Aún sin calificaciones'}
        />
      </View>

      {producto.descripcion ? <Text style={styles.descripcion}>{producto.descripcion}</Text> : null}

      {/* El carrito y la confirmación del pedido se construyen en la fase 4 (AGRO-8). */}
      <View style={styles.acciones}>
        <BotonGrande titulo="🛒 Agregar al carrito" deshabilitado accessibilityHint="Disponible cuando se habiliten los pedidos" onPress={() => {}} />
        <Text style={styles.nota}>El carrito se habilita en la fase 4 (AGRO-8).</Text>
      </View>
    </ScrollView>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  contenido: { paddingBottom: espacio.xl },
  foto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colores.superficie },
  categoria: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: espacio.m, marginHorizontal: espacio.m },
  nombre: { fontSize: texto.grande, fontWeight: '800', color: colores.texto, marginHorizontal: espacio.m },
  precio: { fontSize: texto.grande, fontWeight: '800', color: colores.primario, marginHorizontal: espacio.m, marginBottom: espacio.m },
  porUnidad: { fontSize: texto.base, fontWeight: '600', color: colores.textoSecundario },
  datos: { marginHorizontal: espacio.m, borderRadius: 12, backgroundColor: colores.superficie, padding: espacio.m, gap: espacio.s },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.m },
  datoEtiqueta: { fontSize: texto.base, color: colores.textoSecundario },
  datoValor: { fontSize: texto.base, fontWeight: '700', color: colores.texto, flexShrink: 1, textAlign: 'right' },
  descripcion: { fontSize: texto.base, color: colores.texto, margin: espacio.m, lineHeight: 24 },
  acciones: { paddingHorizontal: espacio.m },
  nota: { fontSize: texto.pequeno, color: colores.textoSecundario, textAlign: 'center' },
});
