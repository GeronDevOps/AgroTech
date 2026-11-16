import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { CampoTexto } from '../../componentes/CampoTexto';
import { Cantidad } from '../../componentes/Cantidad';
import { Opciones } from '../../componentes/Opciones';
import { Aviso } from '../../componentes/Aviso';
import { FotoProducto } from '../../componentes/TarjetaProducto';
import { api } from '../../api/cliente';
import { useCarrito } from '../../carrito/CarritoContext';
import { useConexion } from '../../hooks/useConexion';
import { unidad as datosUnidad } from '../../datos/catalogo';
import { formatoCantidad, formatoPesos, leerNumero } from '../../utilidades/formato';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

const FRANJAS = [{ valor: 'MANANA', texto: 'Mañana', icono: '🌅' }, { valor: 'TARDE', texto: 'Tarde', icono: '🌇' }];
const METODOS = [
  { valor: 'CONTRA_ENTREGA', texto: 'Contra entrega', icono: '💵' },
  { valor: 'EN_LINEA', texto: 'En línea (tarjeta, PSE, Nequi)', icono: '💳' },
];

/**
 * CU-04 · Confirmar pedido (wireframe 4). Muestra un bloque por productor (se crea un pedido por cada uno),
 * pide punto y franja de entrega y método de pago (RF-21), y confirma con la clave de idempotencia del carrito.
 */
export default function Carrito() {
  const router = useRouter();
  const carrito = useCarrito();
  const { enLinea } = useConexion();
  const scrollRef = useRef(null);
  const [punto, setPunto] = useState('');
  const [franja, setFranja] = useState(null);
  const [metodo, setMetodo] = useState('CONTRA_ENTREGA');
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const subir = () => scrollRef.current && scrollRef.current.scrollTo({ y: 0, animated: true });

  async function confirmar() {
    const e = {};
    if (punto.trim().length < 3) e.puntoEntrega = 'Escriba dónde recibe el pedido.';
    if (!franja) e.franjaEntrega = 'Elija mañana o tarde.';
    setErrores(e);
    setAviso(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const r = await api.confirmarPedido(carrito.claveIdempotencia(), {
        items: carrito.lineas.map((l) => ({ idProducto: l.producto.id, cantidad: l.cantidad })),
        puntoEntrega: punto.trim(),
        franjaEntrega: franja,
        metodoPago: metodo,
      });
      carrito.vaciar();
      if (r.pedidos.length === 1) router.replace({ pathname: `/consumidor/pedido/${r.pedidos[0].id}`, params: { nuevo: '1' } });
      else router.replace({ pathname: '/consumidor/pedidos', params: { nuevos: String(r.pedidos.length) } });
    } catch (err) {
      setEnviando(false);
      subir();
      if (err.codigo === 'STOCK_INSUFICIENTE' && err.detalles) {
        carrito.ajustarDisponibles(err.detalles.productos);
        const lista = err.detalles.productos.map((p) => `${p.nombre || 'Un producto'}: hay ${formatoCantidad(p.disponible)}`).join(' · ');
        return setAviso({ tipo: 'error', mensaje: `${err.message} ${lista}. Ya ajustamos su carrito.` });
      }
      if (err.codigo === 'SIN_CONEXION') {
        return setAviso({ tipo: 'sinSenal', mensaje: 'No se pudo confirmar por falta de señal. Su carrito sigue aquí: confirme de nuevo cuando tenga conexión (no se duplicará).' });
      }
      return setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    }
    return undefined;
  }

  if (!carrito.cantidadProductos) {
    return (
      <View style={styles.vacio}>
        <Text style={styles.vacioIcono} importantForAccessibility="no">🛒</Text>
        <Text style={styles.vacioTexto}>Su carrito está vacío.</Text>
        <BotonGrande titulo="Ver catálogo" onPress={() => router.replace('/consumidor')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {!enLinea ? <Aviso tipo="sinSenal" mensaje="Sin señal. Puede revisar el carrito; para confirmar necesita conexión." /> : null}
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-carrito" /> : null}
        {carrito.grupos.length > 1 ? (
          <Aviso tipo="info" mensaje={`Sus productos son de ${carrito.grupos.length} productores: se crea un pedido para cada uno.`} />
        ) : null}

        {carrito.grupos.map((g, i) => (
          <View key={g.productor.id} style={styles.grupo}>
            <Text style={styles.grupoTitulo}>Pedido {i + 1} · {g.productor.nombre}</Text>
            {g.lineas.map((l) => {
              const u = datosUnidad(l.producto.unidad);
              return (
                <View key={l.producto.id} style={styles.linea}>
                  <FotoProducto uri={l.producto.miniaturaUrl} codigoCategoria={l.producto.categoria} style={styles.foto} />
                  <View style={styles.lineaCuerpo}>
                    <Text style={styles.nombre}>{l.producto.nombre}</Text>
                    <Text style={styles.detalle}>{formatoPesos(l.producto.precio)} / {u.nombre} · {formatoPesos(l.cantidad * l.producto.precio)}</Text>
                    <Cantidad
                      etiqueta={`Cantidad (${u.plural})`}
                      etiquetaAccesible={`Cantidad de ${l.producto.nombre} en ${u.plural}`}
                      valor={formatoCantidad(l.cantidad)}
                      onCambiar={(t) => {
                        const n = leerNumero(t, { decimales: true });
                        if (Number.isFinite(n)) carrito.cambiarCantidad(l.producto.id, n); // 0 lo quita del carrito
                      }}
                      minimo={0}
                    />
                  </View>
                </View>
              );
            })}
            <Text style={styles.subtotal}>Subtotal: {formatoPesos(g.subtotal)}</Text>
          </View>
        ))}

        <Text style={styles.total} testID="total-carrito">Total: {formatoPesos(carrito.total)}</Text>

        <Text style={styles.seccion}>Entrega</Text>
        <CampoTexto etiqueta="Punto de entrega" value={punto} onChangeText={setPunto} error={errores.puntoEntrega} placeholder="Ej.: Parque principal de Pamplonita" />
        <Opciones etiqueta="Franja" opciones={FRANJAS} valor={franja} onCambiar={setFranja} error={errores.franjaEntrega} />

        <Text style={styles.seccion}>Pago</Text>
        <Opciones opciones={METODOS} valor={metodo} onCambiar={setMetodo} />
        <Text style={styles.ayuda}>
          {metodo === 'EN_LINEA'
            ? 'Después de confirmar pagará en la página segura de Wompi. El productor acepta el pedido cuando el pago esté aprobado.'
            : 'Paga al productor cuando reciba el pedido.'}
        </Text>

        <BotonGrande titulo={enviando ? 'Confirmando…' : 'Confirmar pedido'} onPress={confirmar} deshabilitado={enviando || !enLinea} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  vacioIcono: { fontSize: 56 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, marginVertical: espacio.m },
  grupo: { borderWidth: 1, borderColor: colores.borde, borderRadius: 14, padding: espacio.m, marginBottom: espacio.m },
  grupoTitulo: { fontSize: texto.base, fontWeight: '800', color: colores.primario, marginBottom: espacio.s },
  linea: { flexDirection: 'row', gap: espacio.m, marginBottom: espacio.s },
  foto: { width: 72, height: 72, borderRadius: 10 },
  lineaCuerpo: { flex: 1 },
  nombre: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  detalle: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.xs },
  subtotal: { fontSize: texto.base, fontWeight: '700', color: colores.texto, textAlign: 'right' },
  total: { fontSize: texto.grande, fontWeight: '800', color: colores.texto, textAlign: 'right', marginBottom: espacio.m },
  seccion: { fontSize: texto.titulo, fontWeight: '800', color: colores.primario, marginTop: espacio.s, marginBottom: espacio.s },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginTop: -espacio.s, marginBottom: espacio.m },
});
