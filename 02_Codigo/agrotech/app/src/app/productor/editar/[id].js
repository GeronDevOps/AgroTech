import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BotonGrande } from '../../../componentes/BotonGrande';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { Cantidad } from '../../../componentes/Cantidad';
import { Aviso } from '../../../componentes/Aviso';
import { EstadoProducto, EstadoSync, FotoProducto } from '../../../componentes/TarjetaProducto';
import { api } from '../../../api/cliente';
import { guardarProductos, productoLocal } from '../../../local/cache';
import { unidad as datosUnidad } from '../../../datos/catalogo';
import { useConexion } from '../../../hooks/useConexion';
import { useSesion } from '../../../sesion/SesionContext';
import { useSincronizacion } from '../../../sync/SincronizacionContext';
import { conCola, productoProvisional } from '../../../sync/superponer';
import { formatoCantidad, formatoPesos, leerNumero } from '../../../utilidades/formato';
import { errorCantidad, errorPrecio } from '../../../validacion/producto';
import { mensajeDeError } from '../../../validacion/cuenta';
import { colores, espacio, texto } from '../../../tema/tema';

const ACCIONES = {
  PAUSAR: { titulo: '⏸ Pausar publicación', ok: '✓ Publicación pausada: ya no aparece en el catálogo. Puede reactivarla cuando quiera.' },
  REACTIVAR: { titulo: '▶ Reactivar publicación', ok: '✓ Publicación reactivada: vuelve a aparecer en el catálogo.' },
  RETIRAR: { titulo: '🗑 Retirar publicación', ok: '✓ Publicación retirada. Sus pedidos anteriores la conservan en el historial.' },
};

/**
 * CU-10 / RF-10 · Actualizar, pausar o retirar una publicación propia.
 * Además de precio y cantidad (RF-10a) edita nombre y descripción; pausar la oculta, reactivar la devuelve
 * y retirar la deja inactiva conservando el histórico. A1: con pedidos en curso solo se puede pausar.
 * - Con red y sin cambios en cola: PATCH con la versión leída; si otra edición ganó primero (409)
 *   se cargan los datos vigentes (CP-17).
 * - Sin red, o si ya hay cambios en cola: el cambio va a la cola del teléfono (CU-17).
 * - Operación "Con error": muestra el motivo y permite corregir (guardar de nuevo), reintentar o descartar (A1).
 */
export default function EditarProducto() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { enLinea } = useConexion();
  const { usuario } = useSesion();
  const sync = useSincronizacion();
  const { operaciones, version: versionSync } = sync;
  const [producto, setProducto] = useState(null);
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [confirmarRetiro, setConfirmarRetiro] = useState(false);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Una recarga en segundo plano (fin de una sincronización) no borra lo que el productor está escribiendo.
  const editado = useRef(false);
  const mostrar = (p, { forzar = false } = {}) => {
    setProducto(p);
    if (forzar || !editado.current) {
      editado.current = false;
      setPrecio(String(p.precio));
      setCantidad(formatoCantidad(p.stock));
      setNombre(p.nombre || '');
      setDescripcion(p.descripcion || '');
    }
  };
  const escribir = (setter) => (v) => { editado.current = true; setter(v); };

  /** Lo que el productor debe ver: la publicación del servidor (o su copia local) con lo que sigue en cola. */
  const leer = useCallback(async () => {
    const ops = await operaciones().catch(() => []);
    const creacion = ops.find((o) => o.tipo === 'CREAR' && o.idEntidad === id);
    if (creacion) return productoProvisional(creacion, usuario);
    let base;
    try {
      base = (await api.producto(id)).producto;
      guardarProductos([base]).catch(() => {});
    } catch (err) {
      base = err.codigo === 'SIN_CONEXION' ? await productoLocal(id).catch(() => null) : null;
      if (!base) throw err;
    }
    return conCola(base, ops);
  }, [id, usuario, operaciones]);

  // Si cambia el estado en la cola (se publicó o quedó con error) el aviso anterior ya no aplica.
  const estadoSyncPrevio = useRef(undefined);
  const cargar = useCallback(async () => {
    try {
      const p = await leer();
      const estado = p.sync ? p.sync.estado : null;
      if (estadoSyncPrevio.current !== undefined && estadoSyncPrevio.current !== estado) setAviso(null);
      estadoSyncPrevio.current = estado;
      mostrar(p);
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    }
  }, [leer]);

  // Al abrir y al terminar cada sincronización (el estado ⏳ / ⚠ cambia).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versionSync solo dispara la recarga
  useFocusEffect(useCallback(() => { cargar(); }, [cargar, versionSync]));

  async function guardarEnCola(cambios) {
    await sync.editarDespues(producto, cambios);
    const p = await leer();
    estadoSyncPrevio.current = p.sync ? p.sync.estado : null;
    mostrar(p, { forzar: true });
    setAviso({ tipo: 'sinSenal', mensaje: '✓ Guardado en el teléfono. Se enviará solo cuando haya señal.' });
  }

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
    const cambios = { precio: leerNumero(precio), stock: leerNumero(cantidad, { decimales: true }) };
    if (nombre.trim() && nombre.trim() !== producto.nombre) cambios.nombre = nombre.trim();
    if (descripcion.trim() !== (producto.descripcion || '')) cambios.descripcion = descripcion.trim();
    try {
      if (!enLinea || producto.sync) {
        await guardarEnCola(cambios);
        return;
      }
      const r = await api.editarProducto(id, { ...cambios, version: producto.version });
      guardarProductos([r.producto]).catch(() => {});
      mostrar(r.producto, { forzar: true });
      setAviso({
        tipo: 'info',
        mensaje: r.producto.estado === 'AGOTADA'
          ? '✓ Guardado. Con cantidad 0 la publicación queda Agotada y sale del catálogo.'
          : '✓ Guardado. El catálogo ya muestra el nuevo precio y la cantidad.',
      });
    } catch (err) {
      if (err.codigo === 'SIN_CONEXION') {
        await guardarEnCola(cambios).catch(() => setAviso({ tipo: 'error', mensaje: mensajeDeError(err) }));
      } else if (err.codigo === 'CONFLICTO_VERSION' && err.detalles && err.detalles.producto) {
        mostrar(err.detalles.producto, { forzar: true });
        setAviso({ tipo: 'sinSenal', mensaje: `${err.message} Ahora ve los datos actuales.` });
      } else {
        setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      }
    } finally {
      setEnviando(false);
    }
  }

  /** CU-10 pasos 1-3: pausar, reactivar o retirar. Sin señal queda en la cola (A4). */
  async function cambiarEstado(accion) {
    setAviso(null);
    setConfirmarRetiro(false);
    setEnviando(true);
    try {
      if (!enLinea) {
        await sync.estadoDespues(producto, accion);
        setAviso({ tipo: 'sinSenal', mensaje: '✓ Guardado en el teléfono. El cambio se enviará solo cuando haya señal.' });
        return;
      }
      const r = await api.cambiarEstadoProducto(id, accion, producto.version);
      guardarProductos([r.producto]).catch(() => {});
      mostrar(r.producto, { forzar: true });
      setAviso({ tipo: 'info', mensaje: ACCIONES[accion].ok });
      if (accion === 'RETIRAR') setTimeout(() => router.back(), 1200);
    } catch (err) {
      if (err.codigo === 'CONFLICTO_VERSION' && err.detalles && err.detalles.producto) {
        mostrar(err.detalles.producto, { forzar: true });
        setAviso({ tipo: 'sinSenal', mensaje: `${err.message} Ahora ve los datos actuales.` });
      } else if (err.codigo === 'SIN_CONEXION') {
        await sync.estadoDespues(producto, accion);
        setAviso({ tipo: 'sinSenal', mensaje: '✓ Guardado en el teléfono. El cambio se enviará solo cuando haya señal.' });
      } else {
        setAviso({ tipo: err.codigo === 'PEDIDOS_EN_CURSO' ? 'sinSenal' : 'error', mensaje: mensajeDeError(err) });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function descartar() {
    await sync.descartar(producto.sync.idOperacion);
    if (producto.sync.nueva) {
      router.back(); // la publicación nunca llegó al servidor
      return;
    }
    editado.current = false;
    await cargar();
    setAviso({ tipo: 'info', mensaje: 'Cambio descartado. Ve los datos publicados.' });
  }

  async function reintentar() {
    await sync.reintentar(producto.sync.idOperacion);
    setAviso({ tipo: 'info', mensaje: enLinea ? 'Reintentando…' : 'Se reintentará al volver la señal.' });
    await cargar();
  }

  if (!producto) {
    return (
      <View style={styles.centro}>
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}
      </View>
    );
  }

  const u = datosUnidad(producto.unidad);
  const conError = producto.sync && producto.sync.estado === 'CON_ERROR';
  const conflicto = conError && producto.sync.error && producto.sync.error.codigo === 'CONFLICTO_VERSION';
  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.cabecera}>
          <FotoProducto uri={producto.miniaturaUrl} codigoCategoria={producto.categoria} style={styles.foto} />
          <View style={styles.cabeceraTexto}>
            <Text style={styles.nombre}>{producto.nombre}</Text>
            <Text style={styles.actual}>{formatoPesos(producto.precio)} / {u.nombre} · {formatoCantidad(producto.stock)} {u.plural}</Text>
            {producto.sync && producto.sync.nueva ? null : <EstadoProducto estado={producto.estado} />}
            {producto.sync ? <EstadoSync sync={producto.sync} /> : null}
          </View>
        </View>

        {conError ? (
          <Aviso
            testID="aviso-error-sync"
            mensaje={conflicto
              ? `No se aplicó su cambio: ${producto.sync.error.mensaje} Abajo están los datos vigentes: corríjalos y guarde de nuevo, o descarte su cambio.`
              : `No se pudo publicar: ${producto.sync.error.mensaje}`}
          >
            {!conflicto ? <BotonGrande titulo="⟳ Reintentar" onPress={reintentar} /> : null}
            <BotonGrande titulo={producto.sync.nueva ? 'Descartar publicación' : 'Descartar mi cambio'} variante="secundario" onPress={descartar} />
          </Aviso>
        ) : null}
        {!enLinea && !conError ? <Aviso tipo="sinSenal" mensaje="Sin señal. Puede guardar igual: el cambio queda en el teléfono y se envía solo al volver la señal." /> : null}
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-editar" /> : null}

        <CampoTexto etiqueta="Nombre del producto" value={nombre} onChangeText={escribir(setNombre)} error={errores.nombre} maxLength={80} />
        <CampoTexto etiqueta="Descripción (opcional)" value={descripcion} onChangeText={escribir(setDescripcion)} error={errores.descripcion} maxLength={500} multiline />
        <Cantidad etiqueta="Cantidad disponible" valor={cantidad} onCambiar={escribir(setCantidad)} error={errores.stock} minimo={0} sufijo={u.plural} />
        <Text style={styles.ayuda}>Si ya no tiene, ponga 0: la publicación queda Agotada.</Text>
        <CampoTexto
          etiqueta={`Precio por ${u.singular}`}
          value={precio}
          onChangeText={(t) => escribir(setPrecio)(t.replace(/[^\d.]/g, ''))}
          error={errores.precio}
          keyboardType="number-pad"
          ayuda="Los pedidos ya hechos conservan el precio con el que se pidieron."
        />
        <BotonGrande titulo={enviando ? 'Guardando…' : 'Guardar cambios'} onPress={guardar} deshabilitado={enviando} />

        {!(producto.sync && producto.sync.nueva) ? (
          <View style={styles.estadoCaja} testID="estado-publicacion">
            <Text style={styles.estadoTitulo}>Estado de la publicación</Text>
            <Text style={styles.ayudaEstado}>Pausar la oculta del catálogo sin borrarla; retirar la quita definitivamente (sus pedidos anteriores la conservan).</Text>
            {producto.estado === 'PAUSADA'
              ? <BotonGrande titulo={ACCIONES.REACTIVAR.titulo} onPress={() => cambiarEstado('REACTIVAR')} deshabilitado={enviando} />
              : <BotonGrande titulo={ACCIONES.PAUSAR.titulo} variante="secundario" onPress={() => cambiarEstado('PAUSAR')} deshabilitado={enviando} />}
            {confirmarRetiro ? (
              <Aviso mensaje="¿Seguro que quiere retirar esta publicación? No se puede deshacer." testID="confirmar-retiro">
                <BotonGrande titulo="Sí, retirar" onPress={() => cambiarEstado('RETIRAR')} deshabilitado={enviando} />
                <BotonGrande titulo="No" variante="secundario" onPress={() => setConfirmarRetiro(false)} />
              </Aviso>
            ) : (
              <BotonGrande titulo={ACCIONES.RETIRAR.titulo} variante="secundario" onPress={() => setConfirmarRetiro(true)} deshabilitado={enviando} />
            )}
          </View>
        ) : null}
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
  estadoCaja: { borderTopWidth: 1, borderTopColor: colores.borde, marginTop: espacio.l, paddingTop: espacio.m },
  estadoTitulo: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  ayudaEstado: { fontSize: texto.pequeno, color: colores.textoSecundario, marginVertical: espacio.xs },
});
