import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso } from '../../componentes/Aviso';
import { AvisoSinSenal } from '../../componentes/AvisoSinSenal';
import { Opciones } from '../../componentes/Opciones';
import { api } from '../../api/cliente';
import { guardarMeta, leerMeta } from '../../local/baseLocal';
import { unidad as datosUnidad } from '../../datos/catalogo';
import { useTiempoReal } from '../../tiempoReal/TiempoRealContext';
import { formatoCantidad, formatoPesos, textoSincronizacion } from '../../utilidades/formato';
import { mensajeDeError } from '../../validacion/cuenta';
import { colores, espacio, texto } from '../../tema/tema';

const PERIODOS = [
  { valor: 'semana', texto: '7 días' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'mes_anterior', texto: 'Mes pasado' },
  { valor: 'anio', texto: 'Este año' },
];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiquetaFecha = (f) => (f.length === 7 ? MESES[Number(f.slice(5, 7)) - 1] : `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`);
const pesosCortos = (n) => (n >= 1e6 ? `$ ${String(Math.round(n / 1e5) / 10).replace('.', ',')} M` : n >= 1e3 ? `$ ${Math.round(n / 1e3)} mil` : formatoPesos(n));

/**
 * CU-07 · Mis ventas (RF-07, wireframe 6): pedidos entregados, ingresos, productos de mayor rotación
 * y gráfico del periodo. Sin señal muestra los últimos datos con su fecha de corte (A2);
 * sin ventas, indicadores en cero con orientación (A1).
 */
export default function Ventas() {
  const [periodo, setPeriodo] = useState('mes');
  const [datos, setDatos] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const { versionPedidos } = useTiempoReal();

  const cargar = useCallback(async (p) => {
    setCargando(true);
    setSeleccion(null);
    try {
      const r = await api.ventas({ periodo: p });
      setDatos(r);
      setDesdeCache(false);
      setError(null);
      guardarMeta(`ventas:${p}`, JSON.stringify(r)).catch(() => {});
    } catch (err) {
      const guardado = err.codigo === 'SIN_CONEXION' ? await leerMeta(`ventas:${p}`).catch(() => null) : null;
      if (guardado) {
        setDatos(JSON.parse(guardado));
        setDesdeCache(true);
        setError(null);
      } else {
        setDatos(null);
        setError(err.codigo === 'SIN_CONEXION' ? 'Sin señal y sin datos guardados de este periodo. Conéctese para verlos.' : mensajeDeError(err));
      }
    } finally {
      setCargando(false);
    }
  }, []);

  // Al cambiar de periodo y cuando un pedido cambia de estado (una entrega suma la venta al panel, CU-13 paso 4).
  useEffect(() => {
    let vigente = true;
    Promise.resolve().then(() => { if (vigente) cargar(periodo); });
    return () => { vigente = false; };
  }, [periodo, cargar, versionPedidos]);

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido} refreshControl={<RefreshControl refreshing={cargando && !!datos} onRefresh={() => cargar(periodo)} colors={[colores.primario]} />}>
      <Opciones etiqueta="Periodo" opciones={PERIODOS} valor={periodo} onCambiar={setPeriodo} />
      {desdeCache && datos ? <AvisoSinSenal detalle={`Cifras con corte ${textoSincronizacion(datos.generadoEn)}.`} /> : null}
      {error ? <Aviso tipo="sinSenal" mensaje={error} /> : null}
      {datos && datos.correccion ? <Aviso tipo="info" mensaje={datos.correccion} /> : null}
      {!datos && !error ? <ActivityIndicator size="large" color={colores.primario} style={{ marginTop: espacio.xl }} /> : null}
      {datos ? <Panel datos={datos} seleccion={seleccion} onSeleccion={setSeleccion} /> : null}
    </ScrollView>
  );
}

function Panel({ datos, seleccion, onSeleccion }) {
  const { resumen, serie, topProductos, enCurso, periodo } = datos;
  const sinVentas = resumen.pedidosEntregados === 0;
  return (
    <View>
      <Text style={styles.rango}>{etiquetaFecha(periodo.desde)} – {etiquetaFecha(periodo.hasta)}</Text>
      {/* El dato principal (ingresos) ocupa toda la fila: los montos en pesos no se recortan en pantallas angostas. */}
      <Indicador titulo="Ingresos del periodo" valor={formatoPesos(resumen.ingresos)} testID="kpi-ingresos" destacado />
      <View style={styles.indicadores}>
        <Indicador titulo="Pedidos entregados" valor={String(resumen.pedidosEntregados)} testID="kpi-pedidos" />
        <Indicador titulo="Promedio por pedido" valor={formatoPesos(resumen.ticketPromedio)} testID="kpi-promedio" />
      </View>

      {sinVentas ? (
        <Aviso tipo="info" testID="sin-ventas" mensaje="Aún no tiene ventas en este periodo. Una venta cuenta cuando marca el pedido como ✅ Entregado." />
      ) : (
        <Grafico serie={serie} agrupacion={periodo.agrupacion} seleccion={seleccion} onSeleccion={onSeleccion} />
      )}

      {topProductos.length ? (
        <View style={styles.seccion}>
          <Text style={styles.subtitulo}>Lo que más vende</Text>
          {topProductos.map((p, i) => {
            const u = datosUnidad(p.unidad);
            const ancho = `${Math.max(4, Math.round((p.ingresos / topProductos[0].ingresos) * 100))}%`;
            return (
              <View key={p.idProducto} style={styles.top} accessibilityLabel={`${i + 1}. ${p.nombre}: ${formatoCantidad(p.cantidad)} ${p.cantidad === 1 ? u.singular : u.plural}, ${formatoPesos(p.ingresos)}, ${p.pedidos} pedidos`}>
                <View style={styles.topFila}>
                  <Text style={styles.topNombre} numberOfLines={1}>{i + 1}. {p.nombre}</Text>
                  <Text style={styles.topValor}>{formatoPesos(p.ingresos)}</Text>
                </View>
                <View style={styles.topBarraFondo}><View style={[styles.topBarra, { width: ancho }]} /></View>
                <Text style={styles.topDetalle}>{formatoCantidad(p.cantidad)} {p.cantidad === 1 ? u.singular : u.plural} · {p.pedidos} {p.pedidos === 1 ? 'pedido' : 'pedidos'}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.enCurso} testID="en-curso">
        <Text style={styles.enCursoTexto}>
          🚚 En curso: {enCurso.pedidos} {enCurso.pedidos === 1 ? 'pedido' : 'pedidos'} por {formatoPesos(enCurso.valor)}.
        </Text>
        <Text style={styles.enCursoNota}>Cuentan como venta al entregarlos.</Text>
      </View>
    </View>
  );
}

function Indicador({ titulo, valor, destacado, testID }) {
  return (
    <View style={destacado ? styles.indicadorDestacado : styles.indicador} testID={testID} accessibilityLabel={`${titulo}: ${valor}`}>
      <Text style={[styles.indicadorValor, destacado && styles.indicadorValorDestacado]}>{valor}</Text>
      <Text style={styles.indicadorTitulo}>{titulo}</Text>
    </View>
  );
}

/**
 * Barras de ingresos del periodo (una serie: un solo tono, sin leyenda; el título la nombra).
 * Barras delgadas con 2 px de separación y extremo redondeado sobre la línea base; tocar una barra
 * muestra su valor (y cada barra se anuncia con su fecha y monto en el lector de pantalla).
 */
function Grafico({ serie, agrupacion, seleccion, onSeleccion }) {
  const maximo = Math.max(...serie.map((d) => d.ingresos), 1);
  const elegido = seleccion !== null ? serie[seleccion] : null;
  const pasoEtiqueta = serie.length > 15 ? 7 : 1;
  return (
    <View style={styles.seccion} testID="grafico-ventas">
      <Text style={styles.subtitulo}>Ingresos por {agrupacion === 'dia' ? 'día' : 'mes'}</Text>
      <Text style={styles.ayuda}>
        {elegido ? `${etiquetaFecha(elegido.fecha)}: ${formatoPesos(elegido.ingresos)} · ${elegido.pedidos} ${elegido.pedidos === 1 ? 'pedido' : 'pedidos'}` : `Máximo ${pesosCortos(maximo)} · toque una barra`}
      </Text>
      <View style={styles.barras}>
        {serie.map((d, i) => (
          <Pressable
            key={d.fecha}
            accessibilityRole="button"
            accessibilityLabel={`${etiquetaFecha(d.fecha)}: ${formatoPesos(d.ingresos)}`}
            onPress={() => onSeleccion(i === seleccion ? null : i)}
            style={styles.barraToque}
          >
            <View style={[styles.barra, { height: `${(d.ingresos / maximo) * 100}%` }, d.ingresos > 0 && styles.barraMinima, i === seleccion && styles.barraElegida]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.ejeX}>
        {serie.map((d, i) => (
          <Text key={d.fecha} style={styles.ejeEtiqueta} numberOfLines={1}>{i % pasoEtiqueta === 0 ? etiquetaFecha(d.fecha).split(' ')[0] : ''}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  rango: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.s },
  indicadores: { flexDirection: 'row', gap: espacio.s, marginBottom: espacio.m, marginTop: espacio.s },
  indicador: { flex: 1, minWidth: 0, borderRadius: 12, padding: espacio.m, backgroundColor: colores.superficie, gap: 2 },
  indicadorDestacado: { borderRadius: 12, padding: espacio.m, backgroundColor: colores.primarioClaro, gap: 2 },
  indicadorValorDestacado: { fontSize: texto.grande + 4, color: colores.enLineaTexto },
  indicadorValor: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  indicadorTitulo: { fontSize: 12, color: colores.textoSecundario },
  seccion: { marginBottom: espacio.m },
  subtitulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginBottom: espacio.s },
  barras: { flexDirection: 'row', alignItems: 'flex-end', height: 140, borderBottomWidth: 1, borderBottomColor: colores.borde },
  barraToque: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  barra: { backgroundColor: colores.primario, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barraMinima: { minHeight: 3 },
  barraElegida: { backgroundColor: colores.enLineaTexto },
  ejeX: { flexDirection: 'row', marginTop: 2 },
  ejeEtiqueta: { flex: 1, fontSize: 10, color: colores.textoSecundario, textAlign: 'center' },
  top: { marginTop: espacio.s, gap: 2 },
  topFila: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s },
  topNombre: { flex: 1, fontSize: texto.base, fontWeight: '700', color: colores.texto },
  topValor: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  topBarraFondo: { height: 8, backgroundColor: colores.superficie, borderRadius: 4 },
  topBarra: { height: 8, backgroundColor: colores.primario, borderRadius: 4 },
  topDetalle: { fontSize: 12, color: colores.textoSecundario },
  enCurso: { borderRadius: 12, padding: espacio.m, backgroundColor: '#FFF8E1' },
  enCursoTexto: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  enCursoNota: { fontSize: texto.pequeno, color: colores.textoSecundario },
});
