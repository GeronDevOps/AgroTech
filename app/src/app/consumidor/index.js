import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BotonGrande } from '../../componentes/BotonGrande';
import { CampoTexto } from '../../componentes/CampoTexto';
import { Aviso } from '../../componentes/Aviso';
import { AvisoSinSenal } from '../../componentes/AvisoSinSenal';
import { HojaSeleccion } from '../../componentes/HojaSeleccion';
import { TarjetaProducto } from '../../componentes/TarjetaProducto';
import { api } from '../../api/cliente';
import { catalogoLocal, guardarProductos } from '../../local/cache';
import { useConexion } from '../../hooks/useConexion';
import { CATEGORIAS, categoria as datosCategoria } from '../../datos/catalogo';
import { MUNICIPIOS } from '../../datos/municipios';
import { useSesion } from '../../sesion/SesionContext';
import { useCarrito } from '../../carrito/CarritoContext';
import { formatoPesos, leerNumero } from '../../utilidades/formato';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto, toque } from '../../tema/tema';

const TAMANO_PAGINA = 20; // RNF-01: primera página de 20 productos con miniaturas
const SIN_FILTROS = { municipio: null, categoria: null, precioMin: null, precioMax: null };

const OPCIONES_MUNICIPIO = [{ valor: null, texto: 'Todos los municipios' }, ...MUNICIPIOS.map((m) => ({ valor: m, texto: m }))];
const OPCIONES_CATEGORIA = [{ valor: null, texto: 'Todas las categorías' }, ...CATEGORIAS.map((c) => ({ valor: c.codigo, texto: c.nombre, icono: c.icono }))];

/**
 * CU-03 · Catálogo con filtros (wireframe 3).
 * Paginado de a 20; filtros por municipio, categoría y precio; sin resultados ofrece limpiar (A1);
 * sin señal (A2 · CU-17) consulta la copia del teléfono con los mismos filtros y muestra la fecha de sincronización.
 */
export default function Catalogo() {
  const router = useRouter();
  const { cerrarSesion } = useSesion();
  const { cantidadProductos } = useCarrito();
  // Cada cambio de filtro o de página es una "solicitud"; el efecto la atiende y guarda la respuesta.
  const [solicitud, setSolicitud] = useState({ filtros: SIN_FILTROS, pagina: 1, n: 0 });
  const [respondida, setRespondida] = useState(-1);
  const [productos, setProductos] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [total, setTotal] = useState(null);
  const [error, setError] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const { enLinea } = useConexion();
  const enLineaRef = useRef(enLinea);
  useEffect(() => { enLineaRef.current = enLinea; }, [enLinea]);
  const [hoja, setHoja] = useState(null); // 'municipio' | 'categoria' | 'precio'

  const { filtros, pagina } = solicitud;
  const cargando = respondida !== solicitud.n;
  const pedir = useCallback((f, p) => setSolicitud((s) => ({ filtros: f, pagina: p, n: s.n + 1 })), []);

  useEffect(() => {
    let vigente = true;
    const q = { ...solicitud.filtros, pagina: solicitud.pagina, tamano: TAMANO_PAGINA };
    const local = () => catalogoLocal(q).then((r) => ({ ...r, local: true }));
    const consulta = enLineaRef.current
      ? api.catalogo(q)
        .then((r) => { guardarProductos(r.productos).catch(() => {}); return { ...r, local: false }; })
        .catch((err) => (err.codigo === 'SIN_CONEXION' ? local() : Promise.reject(err)))
      : local();
    consulta
      .then((r) => {
        if (!vigente) return;
        setProductos((prev) => (solicitud.pagina === 1 ? r.productos : [...prev, ...r.productos]));
        setHayMas(r.hayMas);
        setTotal(r.total);
        setError(null);
        setDesdeCache(r.local);
      })
      .catch((err) => { if (vigente) setError(err); })
      .finally(() => { if (vigente) setRespondida(solicitud.n); });
    return () => { vigente = false; };
  }, [solicitud]);

  const cambiarFiltro = (campo, valor) => {
    setHoja(null);
    pedir({ ...filtros, [campo]: valor }, 1);
  };
  const hayFiltros = Object.values(filtros).some((v) => v !== null);

  const textoPrecio = filtros.precioMin !== null || filtros.precioMax !== null
    ? `${filtros.precioMin !== null ? formatoPesos(filtros.precioMin) : '$ 0'} – ${filtros.precioMax !== null ? formatoPesos(filtros.precioMax) : 'más'}`
    : 'Precio';

  const avisoError = error ? <Aviso mensaje={mensajeDeError(error)} /> : null;

  return (
    <View style={styles.pantalla}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barraFiltros} contentContainerStyle={styles.filtros}>
        <Filtro texto={filtros.municipio || 'Municipio'} activo={!!filtros.municipio} onPress={() => setHoja('municipio')} />
        <Filtro texto={filtros.categoria ? datosCategoria(filtros.categoria).nombre : 'Categoría'} activo={!!filtros.categoria} onPress={() => setHoja('categoria')} />
        <Filtro texto={textoPrecio} activo={filtros.precioMin !== null || filtros.precioMax !== null} onPress={() => setHoja('precio')} />
      </ScrollView>

      <FlatList
        data={productos}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={styles.lista}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (hayMas && !cargando && !error) pedir(filtros, pagina + 1); }}
        refreshControl={<RefreshControl refreshing={cargando && pagina === 1 && productos.length > 0} onRefresh={() => pedir(filtros, 1)} colors={[colores.primario]} />}
        ListHeaderComponent={(
          <>
            {desdeCache ? <AvisoSinSenal detalle="Puede agregar al carrito; para comprar necesita conexión." /> : null}
            {avisoError}
            {total !== null && productos.length ? <Text style={styles.conteo}>{total} {total === 1 ? 'producto' : 'productos'}</Text> : null}
          </>
        )}
        renderItem={({ item }) => (
          <TarjetaProducto producto={item} onPress={() => router.push(`/consumidor/producto/${item.id}`)} />
        )}
        ListEmptyComponent={!cargando && !error ? (
          <View style={styles.vacio} testID="catalogo-vacio">
            <Text style={styles.vacioIcono} importantForAccessibility="no">🔎</Text>
            <Text style={styles.vacioTexto}>
              {hayFiltros ? 'No hay productos con esos filtros.' : desdeCache ? 'Aún no hay productos guardados en el teléfono. Conéctese una vez para descargar el catálogo.' : 'Todavía no hay productos publicados.'}
            </Text>
            {hayFiltros ? <BotonGrande titulo="Limpiar filtros" variante="secundario" onPress={() => pedir(SIN_FILTROS, 1)} /> : null}
          </View>
        ) : null}
        ListFooterComponent={cargando ? <ActivityIndicator style={styles.pie} color={colores.primario} /> : null}
      />

      <View style={styles.barraInferior}>
        <Accion icono="🛒" texto={cantidadProductos ? `Mi carrito (${cantidadProductos})` : 'Mi carrito'} onPress={() => router.push('/consumidor/carrito')} />
        <Accion icono="▤" texto="Mis pedidos" onPress={() => router.push('/consumidor/pedidos')} />
        <Accion icono="💬" texto="Mensajes" onPress={() => router.push('/consumidor/mensajes')} />
        <Accion icono="🚪" texto="Salir" onPress={cerrarSesion} />
      </View>

      <HojaSeleccion
        visible={hoja === 'municipio'} titulo="Municipio" buscador opciones={OPCIONES_MUNICIPIO}
        valor={filtros.municipio} onElegir={(v) => cambiarFiltro('municipio', v)} onCerrar={() => setHoja(null)}
      />
      <HojaSeleccion
        visible={hoja === 'categoria'} titulo="Categoría" opciones={OPCIONES_CATEGORIA}
        valor={filtros.categoria} onElegir={(v) => cambiarFiltro('categoria', v)} onCerrar={() => setHoja(null)}
      />
      <HojaPrecio
        key={hoja === 'precio' ? 'abierta' : 'cerrada'}
        visible={hoja === 'precio'} filtros={filtros} onCerrar={() => setHoja(null)}
        onAplicar={(min, max) => { setHoja(null); pedir({ ...filtros, precioMin: min, precioMax: max }, 1); }}
      />
    </View>
  );
}

function Filtro({ texto: t, activo, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filtro ${t}`}
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      style={({ pressed }) => [styles.filtro, activo && styles.filtroActivo, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.filtroTexto, activo && styles.filtroTextoActivo]}>{t} ▾</Text>
    </Pressable>
  );
}

function Accion({ icono, texto: t, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t} onPress={onPress} style={({ pressed }) => [styles.accion, pressed && { opacity: 0.7 }]}>
      <Text style={styles.accionIcono} importantForAccessibility="no">{icono}</Text>
      <Text style={styles.accionTexto}>{t}</Text>
    </Pressable>
  );
}

/** Se monta de nuevo cada vez que se abre (key), así arranca con los valores del filtro vigente. */
function HojaPrecio({ visible, filtros, onAplicar, onCerrar }) {
  const [min, setMin] = useState(filtros.precioMin !== null ? String(filtros.precioMin) : '');
  const [max, setMax] = useState(filtros.precioMax !== null ? String(filtros.precioMax) : '');
  const [error, setError] = useState(null);

  const aplicar = () => {
    const a = min ? leerNumero(min) : null;
    const b = max ? leerNumero(max) : null;
    if ((a !== null && !Number.isFinite(a)) || (b !== null && !Number.isFinite(b))) return setError('Escriba solo números.');
    if (a !== null && b !== null && a > b) return setError('El precio máximo debe ser mayor que el mínimo.');
    return onAplicar(a, b);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.modal}>
        <Text style={styles.modalTitulo} accessibilityRole="header">Precio por unidad de venta</Text>
        {error ? <Aviso mensaje={error} /> : null}
        <CampoTexto etiqueta="Desde ($)" value={min} onChangeText={(t) => setMin(t.replace(/[^\d.]/g, ''))} keyboardType="number-pad" placeholder="Ej.: 1000" />
        <CampoTexto etiqueta="Hasta ($)" value={max} onChangeText={(t) => setMax(t.replace(/[^\d.]/g, ''))} keyboardType="number-pad" placeholder="Ej.: 50000" />
        <BotonGrande titulo="Aplicar" onPress={aplicar} />
        <BotonGrande titulo="Quitar filtro de precio" variante="secundario" onPress={() => onAplicar(null, null)} />
        <BotonGrande titulo="Cerrar" variante="secundario" onPress={onCerrar} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  barraFiltros: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colores.superficie },
  filtros: { padding: espacio.s, gap: espacio.s },
  filtro: {
    minHeight: toque.minimo, justifyContent: 'center', paddingHorizontal: espacio.m, borderRadius: 24,
    borderWidth: 2, borderColor: colores.borde, backgroundColor: colores.fondo,
  },
  filtroActivo: { borderColor: colores.primario, backgroundColor: colores.primarioClaro },
  filtroTexto: { fontSize: texto.base, color: colores.texto },
  filtroTextoActivo: { fontWeight: '700', color: colores.enLineaTexto },
  lista: { padding: espacio.s, flexGrow: 1 },
  conteo: { fontSize: texto.pequeno, color: colores.textoSecundario, marginHorizontal: espacio.xs, marginBottom: espacio.xs },
  vacio: { alignItems: 'center', padding: espacio.xl },
  vacioIcono: { fontSize: 48 },
  vacioTexto: { fontSize: texto.base, color: colores.textoSecundario, marginVertical: espacio.s, textAlign: 'center' },
  pie: { padding: espacio.m },
  barraInferior: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colores.borde, backgroundColor: colores.fondo },
  accion: { flex: 1, minHeight: toque.boton + 8, alignItems: 'center', justifyContent: 'center' },
  accionIcono: { fontSize: texto.titulo },
  accionTexto: { fontSize: texto.pequeno, fontWeight: '700', color: colores.texto },
  modal: { flex: 1, backgroundColor: colores.fondo, padding: espacio.m },
  modalTitulo: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto, marginBottom: espacio.m },
});
