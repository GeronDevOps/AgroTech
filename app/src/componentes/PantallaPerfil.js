import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CampoTexto } from './CampoTexto';
import { BotonGrande } from './BotonGrande';
import { Aviso } from './Aviso';
import { SelectorMunicipio } from './SelectorMunicipio';
import { api } from '../api/cliente';
import { useSesion } from '../sesion/SesionContext';
import { useConexion } from '../hooks/useConexion';
import { useSincronizacion } from '../sync/SincronizacionContext';
import { ubicacionDelTelefono } from '../ubicacion/ubicacion';
import { limpiarTelefono, mensajeDeError } from '../validacion/cuenta';
import { colores, espacio, texto } from '../tema/tema';

const CAMPOS = ['nombres', 'apellidos', 'telefono', 'correo', 'municipio', 'veredaDireccion'];

/**
 * CU-09 · Mi perfil (RF-09). Edita contacto y ubicación; el rol no se puede cambiar (A1).
 * Un celular o correo de otra cuenta se marca en el campo (A2). Sin señal, el cambio queda en el teléfono (A3).
 */
export function PantallaPerfil() {
  const { usuario, actualizarUsuario } = useSesion();
  const { enLinea } = useConexion();
  const sync = useSincronizacion();
  const [original, setOriginal] = useState(null);
  const [datos, setDatos] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const mostrar = useCallback((p) => {
    const d = Object.fromEntries(CAMPOS.map((c) => [c, p[c] || '']));
    setOriginal(d);
    setDatos(d);
    setUbicacion(p.ubicacion || null);
  }, []);

  useEffect(() => {
    api.perfil().then((r) => mostrar(r.perfil)).catch((err) => {
      // Sin señal se edita sobre los datos de la sesión guardada.
      if (err.codigo === 'SIN_CONEXION') mostrar(usuario);
      else setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
    });
  }, [mostrar, usuario]);

  if (!datos) return <View style={styles.centro}>{aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} /> : <ActivityIndicator size="large" color={colores.primario} />}</View>;

  const poner = (campo) => (v) => setDatos((d) => ({ ...d, [campo]: v }));
  const cambios = () => {
    const c = {};
    for (const k of CAMPOS) if ((datos[k] || '') !== (original[k] || '')) c[k] = k === 'telefono' ? limpiarTelefono(datos[k]) : datos[k];
    return c;
  };

  async function usarUbicacion() {
    setAviso(null);
    const u = await ubicacionDelTelefono();
    if (!u) {
      setAviso({ tipo: 'sinSenal', mensaje: 'No se pudo leer la ubicación del teléfono (permiso negado o sin GPS). Se usará la cabecera de su municipio.' });
      return;
    }
    await guardar({ ubicacion: u });
  }

  async function guardar(extra = {}) {
    const c = { ...cambios(), ...extra };
    setErrores({});
    setAviso(null);
    if (!Object.keys(c).length) { setAviso({ tipo: 'info', mensaje: 'No hay cambios para guardar.' }); return; }
    setEnviando(true);
    try {
      if (!enLinea) throw Object.assign(new Error('sin señal'), { codigo: 'SIN_CONEXION' });
      const r = await api.actualizarPerfil(c);
      mostrar(r.perfil);
      await actualizarUsuario({ nombres: r.perfil.nombres, apellidos: r.perfil.apellidos, telefono: r.perfil.telefono, correo: r.perfil.correo, municipio: r.perfil.municipio, veredaDireccion: r.perfil.veredaDireccion });
      setAviso({ tipo: 'info', mensaje: c.ubicacion ? '✓ Guardamos la ubicación de su teléfono.' : '✓ Datos guardados.' });
    } catch (err) {
      if (err.codigo === 'SIN_CONEXION') {
        await sync.perfilDespues(usuario.id, c);
        setOriginal({ ...datos });
        setAviso({ tipo: 'sinSenal', mensaje: '✓ Guardado en el teléfono. Se enviará solo cuando haya señal.' });
      } else if (err.codigo === 'DATO_EN_USO') {
        setErrores({ [err.detalles.campo]: err.message });
      } else if (err.detalles && err.detalles.campos) {
        setErrores(err.detalles.campos);
      } else {
        setAviso({ tipo: 'error', mensaje: mensajeDeError(err) });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.rol}>
          <Text style={styles.rolTexto}>Cuenta de {usuario.rol === 'PRODUCTOR' ? 'productor' : 'consumidor'}{usuario.verificado ? ' · ✔ verificado' : ''}</Text>
          <Text style={styles.ayuda}>El tipo de cuenta lo cambia la asociación.</Text>
        </View>
        {aviso ? <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} testID="aviso-perfil" /> : null}
        <CampoTexto etiqueta="Nombres" value={datos.nombres} onChangeText={poner('nombres')} error={errores.nombres} />
        <CampoTexto etiqueta="Apellidos" value={datos.apellidos} onChangeText={poner('apellidos')} error={errores.apellidos} />
        <CampoTexto etiqueta="Celular" value={datos.telefono} onChangeText={poner('telefono')} error={errores.telefono} keyboardType="phone-pad" />
        <CampoTexto etiqueta="Correo" value={datos.correo} onChangeText={poner('correo')} error={errores.correo} keyboardType="email-address" autoCapitalize="none" />
        <SelectorMunicipio valor={datos.municipio} onCambiar={poner('municipio')} error={errores.municipio} />
        <CampoTexto etiqueta="Vereda o dirección (opcional)" value={datos.veredaDireccion} onChangeText={poner('veredaDireccion')} error={errores.veredaDireccion} />
        <BotonGrande titulo={enviando ? 'Guardando…' : 'Guardar cambios'} onPress={() => guardar()} deshabilitado={enviando} />

        <View style={styles.caja}>
          <Text style={styles.subtitulo}>📍 Ubicación para «Cerca de mí»</Text>
          <Text style={styles.ayuda} testID="origen-ubicacion">
            {ubicacion
              ? (ubicacion.origen === 'TELEFONO' ? 'Usamos la ubicación que guardó desde su teléfono.' : `Usamos la cabecera municipal de ${datos.municipio}.`)
              : 'Sin ubicación guardada.'}
          </Text>
          {errores.ubicacion ? <Text style={styles.error}>{errores.ubicacion}</Text> : null}
          <BotonGrande titulo="Usar la ubicación de mi teléfono" variante="secundario" onPress={usarUbicacion} deshabilitado={enviando || !enLinea} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centro: { flex: 1, justifyContent: 'center', padding: espacio.l, backgroundColor: colores.fondo },
  contenido: { padding: espacio.m, paddingBottom: espacio.xl },
  rol: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginBottom: espacio.m },
  rolTexto: { fontSize: texto.base, fontWeight: '700', color: colores.texto },
  caja: { backgroundColor: colores.superficie, borderRadius: 12, padding: espacio.m, marginTop: espacio.l },
  subtitulo: { fontSize: texto.base, fontWeight: '800', color: colores.texto },
  ayuda: { fontSize: texto.pequeno, color: colores.textoSecundario, marginVertical: espacio.xs },
  error: { fontSize: texto.pequeno, color: colores.error },
});
