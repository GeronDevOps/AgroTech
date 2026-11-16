import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useCarrito } from '../../carrito/CarritoContext';
import { formatoPesos, leerNumero } from '../../utilidades/formato';
import { ORDENES, RADIOS } from '../../datos/fase2';
import { ubicacionDelTelefono } from '../../ubicacion/ubicacion';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto, toque } from '../../tema/tema';

const TAMANO_PAGINA = 20; // RNF-01: primera página de 20 productos con miniaturas
const SIN_FILTROS = { municipio: null, categoria: null, precioMin: null, precioMax: null, q: null, orden: 'recientes', radioKm: null };
const OPCIONES_ORDEN = ORDENES.map((o) => ({ valor: o.valor, texto: o.texto, icono: o.icono }));
const OPCIONES_RADIO = RADIOS.map((r) => ({ valor: r.valor, texto: r.texto }));

const OPCIONES_MUNICIPIO = [{ valor: null, texto: 'Todos los municipios' }, ...MUNICIPIOS.map((m) => ({ valor: m, texto: m }))];
const OPCIONES_CATEGORIA = [{ valor: null, texto: 'Todas las categorías' }, ...CATEGORIAS.map((c) => ({ valor: c.codigo, texto: c.nombre, icono: c.icono }))];

/**
 * CU-03 · Catálogo con filtros (wireframe 3) · CU-11 búsqueda y orden · CU-12 «Cerca de mí».
 * Paginado de a 20; filtros por municipio, categoría y precio; sin resultados ofrece limpiar (A1);
 * sin señal (A2 · CU-17) consulta la copia del teléfono con los mismos filtros y muestra la fecha de sincronización.
 * Búsqueda por texto (≥ 3 letras) sin distinguir tildes; sin coincidencias sugiere categorías (CU-11 A1).
 * «Cerca de mí» usa la ubicación del teléfono con permiso o, si no, la del perfil (CU-12 A1); con radio sin
 * resultados propone ampliarlo (A2); sin señal no está disponible (A3).
 */
export default function Catalogo() {
  const router = useRouter();
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
  const [hoja, setHoja] = useState(null); // 'municipio' | 'categoria' | 'precio' | 'orden' | 'radio'
  const [busqueda, setBusqueda] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [extra, setExtra] = useState({}); // { sugerencias, ampliarRadio, ubicacion } de la última respuesta
  const ubicacionRef = useRef(null);
  const [avisoUbicacion, setAvisoUbicacion] = useState(null);

  const { filtros, pagina } = solicitud;
  const cargando = respondida !== solicitud.n;
  const pedir = useCallback((f, p) => setSolicitud((s) => ({ filtros: f, pagina: p, n: s.n + 1 })), []);

  useEffect(() => {
    let vigente = true;
    const f = solicitud.filtros;
    const cercania = f.orden === 'cercania';
    // El orden por defecto (recientes) no se envía: la API usa el mismo y la URL queda igual a la del MVP.
    const q = {
      ...f, orden: f.orden === 'recientes' ? undefined : f.orden, pagina: solicitud.pagina, tamano: TAMANO_PAGINA,
      ...(cercania && ubicacionRef.current ? ubicacionRef.current : {}),
    };
    // CU-12 A3: sin señal «Cerca de mí» no está disponible; la copia local se ordena por fecha.
    const local = () => catalogoLocal({ ...q, orden: cercania ? 'recientes' : f.orden }).then((r) => ({ ...r, local: true }));
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
        setExtra({ sugerencias: r.sugerencias, ampliarRadio: r.ampliarRadio, ubicacion: r.ubicacion });
      })
      .catch((err) => { if (vigente) setError(err); })
      .finally(() => { if (vigente) setRespondida(solicitud.n); });
    return () => { vigente = false; };
  }, [solicitud]);

  const cambiarFiltro = (campo, valor) => {
    setHoja(null);
    pedir({ ...filtros, [campo]: valor }, 1);
  };
  const hayFiltros = ['municipio', 'categoria', 'precioMin', 'precioMax', 'q', 'radioKm'].some((k) => filtros[k] !== null);

  /** CU-11 paso 1: mínimo 3 caracteres; los demás filtros se conservan. */
  const buscar = () => {
    const t = busqueda.trim();
    if (t && t.length < 3) { setErrorBusqueda('Escriba al menos 3 letras.'); return; }
    setErrorBusqueda(null);
    pedir({ ...filtros, q: t || null }, 1);
  };
  const limpiarBusqueda = () => { setBusqueda(''); setErrorBusqueda(null); pedir({ ...filtros, q: null }, 1); };

  /** CU-12 pasos 1-2: con permiso usa el GPS; si se niega, la API usa el municipio del perfil (A1). */
  const cambiarOrden = async (orden) => {
    setHoja(null);
    setAvisoUbicacion(null);
    if (orden === 'cercania') {
      if (!enLineaRef.current) { setAvisoUbicacion('«Cerca de mí» necesita señal. Mientras tanto se muestran por fecha.'); }
      ubicacionRef.current = enLineaRef.current ? await ubicacionDelTelefono() : null;
      if (enLineaRef.current && !ubicacionRef.current) setAvisoUbicacion('No tenemos permiso para usar su ubicación: ordenamos según el municipio de su perfil.');
    }
    pedir({ ...filtros, orden, radioKm: orden === 'cercania' ? filtros.radioKm : null }, 1);
  };
  const textoOrden = (ORDENES.find((o) => o.valor === filtros.orden) || ORDENES[0]).texto;
  const textoRadio = (RADIOS.find((r) => r.valor === filtros.radioKm) || RADIOS[0]).texto;

  const textoPrecio = filtros.precioMin !== null || filtros.precioMax !== null
    ? `${filtros.precioMin !== null ? formatoPesos(filtros.precioMin) : '$ 0'} – ${filtros.precioMax !== null ? formatoPesos(filtros.precioMax) : 'más'}`
    : 'Precio';

  const avisoError = error ? <Aviso mensaje={mensajeDeError(error)} /> : null;

  return (
    <View style={styles.pantalla}>
      <View style={styles.buscador}>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          onSubmitEditing={buscar}
          placeholder="Buscar: papa, café, mora…"
          placeholderTextColor={colores.textoSecundario}
          accessibilityLabel="Buscar productos"
          returnKeyType="search"
          style={styles.buscadorEntrada}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Buscar" onPress={buscar} style={styles.buscadorBoton}>
          <Text style={styles.buscadorIcono}>🔎</Text>
        </Pressable>
        {filtros.q ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar búsqueda" onPress={limpiarBusqueda} style={styles.buscadorBoton}>
            <Text style={styles.buscadorIcono}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      {errorBusqueda ? <Text style={styles.errorBusqueda}>{errorBusqueda}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barraFiltros} contentContainerStyle={styles.filtros}>
        <Filtro texto={filtros.municipio || 'Municipio'} activo={!!filtros.municipio} onPress={() => setHoja('municipio')} />
        <Filtro texto={filtros.categoria ? datosCategoria(filtros.categoria).nombre : 'Categoría'} activo={!!filtros.categoria} onPress={() => setHoja('categoria')} />
        <Filtro texto={textoPrecio} activo={filtros.precioMin !== null || filtros.precioMax !== null} onPress={() => setHoja('precio')} />
        <Filtro texto={textoOrden} etiqueta="Orden" activo={filtros.orden !== 'recientes'} onPress={() => setHoja('orden')} />
        {filtros.orden === 'cercania' ? <Filtro texto={textoRadio} etiqueta="Radio" activo={filtros.radioKm !== null} onPress={() => setHoja('radio')} /> : null}
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
            {desdeCache ? <AvisoSinSenal detalle={filtros.q ? 'Buscamos en la copia del teléfono: puede estar desactualizada.' : 'Puede agregar al carrito; para comprar necesita conexión.'} /> : null}
            {avisoUbicacion ? <Aviso tipo="sinSenal" mensaje={avisoUbicacion} testID="aviso-ubicacion" /> : null}
            {!desdeCache && extra.ubicacion && filtros.orden === 'cercania' ? (
              <Text style={styles.conteo} testID="origen-cercania">📍 Distancias desde {extra.ubicacion.origen === 'TELEFONO' ? 'su ubicación actual' : `su municipio (${extra.ubicacion.municipio})`}</Text>
            ) : null}
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
              {filtros.q ? `No encontramos «${filtros.q}».` : filtros.radioKm ? `No hay productores a menos de ${filtros.radioKm} km.` : hayFiltros ? 'No hay productos con esos filtros.' : desdeCache ? 'Aún no hay productos guardados en el teléfono. Conéctese una vez para descargar el catálogo.' : 'Todavía no hay productos publicados.'}
            </Text>
            {extra.sugerencias && extra.sugerencias.length ? (
              <View style={styles.sugerencias} testID="sugerencias">
                <Text style={styles.vacioTexto}>Pruebe con estas categorías:</Text>
                {extra.sugerencias.map((c) => (
                  <BotonGrande key={c} titulo={`${datosCategoria(c).icono} ${datosCategoria(c).nombre}`} variante="secundario"
                    onPress={() => { setBusqueda(''); pedir({ ...filtros, q: null, categoria: c }, 1); }} />
                ))}
              </View>
            ) : null}
            {extra.ampliarRadio ? (
              <BotonGrande titulo={`Ampliar a ${extra.ampliarRadio.sugeridoKm} km`} onPress={() => pedir({ ...filtros, radioKm: extra.ampliarRadio.sugeridoKm }, 1)} />
            ) : null}
            {hayFiltros ? <BotonGrande titulo="Limpiar filtros" variante="secundario" onPress={() => { setBusqueda(''); pedir(SIN_FILTROS, 1); }} /> : null}
          </View>
        ) : null}
        ListFooterComponent={cargando ? <ActivityIndicator style={styles.pie} color={colores.primario} /> : null}
      />

      <View style={styles.barraInferior}>
        <Accion icono="🛒" texto={cantidadProductos ? `Mi carrito (${cantidadProductos})` : 'Mi carrito'} onPress={() => router.push('/consumidor/carrito')} />
        <Accion icono="▤" texto="Mis pedidos" onPress={() => router.push('/consumidor/pedidos')} />
        <Accion icono="💬" texto="Mensajes" onPress={() => router.push('/consumidor/mensajes')} />
        <Accion icono="👤" texto="Mi cuenta" onPress={() => router.push('/consumidor/cuenta')} />
      </View>

      <HojaSeleccion
        visible={hoja === 'municipio'} titulo="Municipio" buscador opciones={OPCIONES_MUNICIPIO}
        valor={filtros.municipio} onElegir={(v) => cambiarFiltro('municipio', v)} onCerrar={() => setHoja(null)}
      />
      <HojaSeleccion
        visible={hoja === 'categoria'} titulo="Categoría" opciones={OPCIONES_CATEGORIA}
        valor={filtros.categoria} onElegir={(v) => cambiarFiltro('categoria', v)} onCerrar={() => setHoja(null)}
      />
      <HojaSeleccion
        visible={hoja === 'orden'} titulo="Ordenar por" opciones={OPCIONES_ORDEN}
        valor={filtros.orden} onElegir={cambiarOrden} onCerrar={() => setHoja(null)}
      />
      <HojaSeleccion
        visible={hoja === 'radio'} titulo="¿Qué tan lejos?" opciones={OPCIONES_RADIO}
        valor={filtros.radioKm} onElegir={(v) => cambiarFiltro('radioKm', v)} onCerrar={() => setHoja(null)}
      />
      <HojaPrecio
        key={hoja === 'precio' ? 'abierta' : 'cerrada'}
        visible={hoja === 'precio'} filtros={filtros} onCerrar={() => setHoja(null)}
        onAplicar={(min, max) => { setHoja(null); pedir({ ...filtros, precioMin: min, precioMax: max }, 1); }}
      />
    </View>
  );
}

function Filtro({ texto: t0, etiqueta, activo, onPress }) {
  const t = etiqueta ? `${etiqueta}: ${t0}` : t0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta ? t : `Filtro ${t}`}
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
  buscador: { flexDirection: 'row', alignItems: 'center', margin: espacio.s, marginBottom: 0, borderWidth: 2, borderColor: colores.borde, borderRadius: 12 },
  buscadorEntrada: { flex: 1, minHeight: toque.minimo, fontSize: texto.base, paddingHorizontal: espacio.m, color: colores.texto },
  buscadorBoton: { minWidth: toque.minimo, minHeight: toque.minimo, alignItems: 'center', justifyContent: 'center' },
  buscadorIcono: { fontSize: texto.titulo },
  errorBusqueda: { color: colores.error, fontSize: texto.pequeno, marginHorizontal: espacio.m },
  sugerencias: { alignSelf: 'stretch', marginTop: espacio.s },
  // flexShrink 0: con una lista larga, la vista web aplastaba la barra de filtros (hallado por la suite E2E).
  barraFiltros: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: colores.superficie },
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
