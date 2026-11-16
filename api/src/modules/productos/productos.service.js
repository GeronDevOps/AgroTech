'use strict';

const crypto = require('node:crypto');
const { errores } = require('../../utils/http-error');
const {
  validarPublicacion, validarFotos, validarEdicion, validarFiltros, validarCambioEstadoProducto, esUuid, ACCIONES_ESTADO,
} = require('./productos.validacion');
const { registrarBitacora } = require('../../utils/bitacora');

const claveMiniatura = (clave) => clave.replace(/\.jpg$/, '_min.jpg');

/**
 * Publicación pública de un producto. Del productor solo se expone nombre e inicial del apellido
 * (RNF-05: solo los datos necesarios).
 */
function productoPublico(f, almacen, baseFotos) {
  return {
    id: f.id_producto,
    nombre: f.nombre,
    descripcion: f.descripcion,
    categoria: f.categoria,
    precio: Number(f.precio),
    unidad: f.unidad_medida,
    stock: Number(f.stock),
    estado: f.estado,
    municipio: f.municipio,
    version: f.version,
    fotoUrl: almacen.urlPublica(f.foto_url, baseFotos),
    miniaturaUrl: almacen.urlPublica(claveMiniatura(f.foto_url), baseFotos),
    fechaPublicacion: f.fecha_publicacion,
    actualizadoEn: f.actualizado_en,
    ...(f.distancia_m !== undefined && f.distancia_m !== null ? { distanciaKm: Math.round(Number(f.distancia_m) / 100) / 10 } : {}),
    productor: {
      id: f.id_productor,
      nombre: `${f.productor_nombres} ${f.productor_apellidos.charAt(0)}.`,
      verificado: f.productor_verificado,
      calificacion: {
        promedio: f.calificacion_promedio === null ? null : Number(f.calificacion_promedio),
        total: Number(f.calificacion_total),
      },
    },
  };
}

/**
 * Capa de negocio de CU-02 (publicar), CU-10/RF-10a (editar precio y cantidad) y CU-03 (catálogo).
 */
function createProductosService({ productosRepository, almacenFotos, limitesFotos }) {
  const publico = (fila, base) => productoPublico(fila, almacenFotos, base);

  return {
    /**
     * CU-02. Idempotente por id generado en el teléfono: reenviar la misma publicación
     * (cola sin conexión, CU-17) devuelve la existente sin duplicar fotos ni filas.
     */
    async publicar({ usuario, datos, archivos, baseFotos }) {
      const d = validarPublicacion(datos);
      validarFotos(archivos, limitesFotos);
      const id = d.id || crypto.randomUUID();

      const existente = await productosRepository.buscarPorId(id);
      if (existente) return reintento(existente);

      const fotoClave = `productos/${usuario.id}/${id}.jpg`;
      const limpiarFotos = () => Promise.allSettled([almacenFotos.eliminar(fotoClave), almacenFotos.eliminar(claveMiniatura(fotoClave))]);
      try {
        await almacenFotos.guardar(fotoClave, archivos.foto.buffer, 'image/jpeg');
        await almacenFotos.guardar(claveMiniatura(fotoClave), archivos.miniatura.buffer, 'image/jpeg');
      } catch {
        // S3 (o el disco) no respondió: no quedan fotos huérfanas y la app reintenta desde su cola (5xx = reintentar).
        // Si un reintento simultáneo ya creó la publicación, sus fotos (misma clave) se conservan.
        if (!(await productosRepository.buscarPorId(id))) await limpiarFotos();
        throw errores.noDisponible('No se pudo guardar la foto. Intente de nuevo en unos minutos.');
      }
      try {
        const creado = await productosRepository.insertar({ ...d, id, idProductor: usuario.id, fotoClave });
        const fila = await productosRepository.buscarPorId(id);
        if (!creado) return reintento(fila); // carrera entre dos reintentos simultáneos
        return { creado: true, producto: publico(fila, baseFotos) };
      } catch (err) {
        await limpiarFotos();
        throw err;
      }

      function reintento(fila) {
        if (fila.id_productor !== usuario.id) throw errores.conflicto('ID_EN_USO', 'El identificador ya pertenece a otra publicación.');
        return { creado: false, producto: publico(fila, baseFotos) };
      }
    },

    /** RF-10a. 409 CONFLICTO_VERSION si otra edición ganó primero (CP-17); devuelve la versión vigente. */
    async editar({ usuario, id, cambios, baseFotos, db }) {
      const c = validarEdicion(cambios);
      const actual = esUuid(id) ? await productosRepository.buscarPorId(id, db) : null;
      if (!actual || actual.id_productor !== usuario.id || actual.estado === 'INACTIVA') {
        throw errores.noEncontrado('La publicación no existe.');
      }
      const ok = await productosRepository.actualizarPrecioStock(id, usuario.id, c, db);
      if (!ok) {
        const vigente = await productosRepository.buscarPorId(id, db);
        throw errores.conflicto(
          'CONFLICTO_VERSION',
          'La publicación cambió mientras la editaba. Revise los datos actuales.',
          { producto: publico(vigente, baseFotos) },
        );
      }
      return { producto: publico(await productosRepository.buscarPorId(id, db), baseFotos) };
    },

    /**
     * CU-03 / CU-11 / CU-12: página del catálogo con filtros, búsqueda por texto y orden.
     * "Cerca de mí": usa la ubicación del teléfono si llegó; si no, la del perfil (o la cabecera de su municipio, A1).
     * Sin coincidencias en la búsqueda sugiere categorías frecuentes (CU-11 A1); sin productores en el radio
     * propone ampliarlo (CU-12 A2).
     */
    async catalogo({ query, baseFotos, usuario }) {
      const f = validarFiltros(query);
      let ubicacion = null;
      if (f.punto) ubicacion = { ...f.punto, origen: 'TELEFONO' };
      else if ((f.orden === 'cercania' || f.radioKm) && usuario) {
        const u = await productosRepository.ubicacionDelUsuario(usuario.id);
        if (u) {
          f.punto = { lat: u.lat, lon: u.lon };
          ubicacion = { ...f.punto, origen: 'PERFIL', municipio: u.municipio };
        }
      }
      if ((f.orden === 'cercania' || f.radioKm) && !f.punto) {
        throw errores.conflicto('UBICACION_REQUERIDA', 'Para ordenar por cercanía necesitamos su ubicación o el municipio de su perfil.');
      }
      const { filas, total } = await productosRepository.catalogo(f);
      const totalReal = total ?? (f.pagina === 1 ? 0 : await productosRepository.contarCatalogo(f));
      const r = {
        productos: filas.map((fila) => publico(fila, baseFotos)),
        pagina: f.pagina,
        tamano: f.tamano,
        total: totalReal,
        hayMas: f.pagina * f.tamano < totalReal,
        orden: f.orden,
      };
      if (ubicacion) r.ubicacion = ubicacion;
      if (totalReal === 0 && f.q) r.sugerencias = (await productosRepository.categoriasFrecuentes()).map((c) => c.categoria);
      if (totalReal === 0 && f.radioKm) r.ampliarRadio = { radioActualKm: f.radioKm, sugeridoKm: Math.min(300, f.radioKm * 2) };
      return r;
    },

    /**
     * CU-10 · Pausar, reactivar o retirar una publicación (RF-10).
     * A1: con pedidos en curso se puede pausar pero no retirar. Reactivar una publicación sin cantidad la deja Agotada.
     * `db`: desde /sync/push (cambio hecho sin señal, A4).
     */
    async cambiarEstado({ usuario, id, body, baseFotos, db }) {
      const { accion, version } = validarCambioEstadoProducto(body);
      const conexion = db || undefined;
      const actual = esUuid(id) ? await productosRepository.buscarPorId(id, conexion) : null;
      if (!actual || actual.id_productor !== usuario.id || actual.estado === 'INACTIVA') throw errores.noEncontrado('La publicación no existe.');
      const permitidas = { PAUSAR: ['ACTIVA', 'AGOTADA'], REACTIVAR: ['PAUSADA'], RETIRAR: ['ACTIVA', 'AGOTADA', 'PAUSADA'] };
      if (!permitidas[accion].includes(actual.estado)) {
        throw errores.conflicto('ESTADO_NO_PERMITIDO', `No se puede ${accion.toLowerCase()} una publicación ${actual.estado.toLowerCase()}.`);
      }
      if (accion === 'RETIRAR') {
        const n = await productosRepository.pedidosEnCurso(id, conexion);
        if (n > 0) {
          throw errores.conflicto('PEDIDOS_EN_CURSO', `Tiene ${n === 1 ? 'un pedido' : `${n} pedidos`} en curso con este producto. Puede pausarla ahora y retirarla cuando se entreguen.`, { pedidos: n });
        }
      }
      let estado = ACCIONES_ESTADO[accion];
      if (accion === 'REACTIVAR' && Number(actual.stock) === 0) estado = 'AGOTADA';
      const ok = await productosRepository.cambiarEstado(id, usuario.id, { estado, version }, conexion);
      if (!ok) {
        throw errores.conflicto('CONFLICTO_VERSION', 'La publicación cambió mientras la editaba. Revise los datos actuales.', {
          producto: publico(await productosRepository.buscarPorId(id, conexion), baseFotos),
        });
      }
      await registrarBitacora(db || productosRepository.pool, { idUsuario: usuario.id, accion: `PRODUCTO_${accion}`, entidad: 'PRODUCTO', idEntidad: id, resultado: estado });
      return { producto: publico(await productosRepository.buscarPorId(id, conexion), baseFotos) };
    },

    /** CU-03 paso 3. Lo pausado o retirado solo lo ve su dueño; lo agotado se muestra como "Agotado" (A3). */
    async detalle({ usuario, id, baseFotos }) {
      const fila = esUuid(id) ? await productosRepository.buscarPorId(id) : null;
      const visible = fila && (fila.id_productor === usuario.id || ['ACTIVA', 'AGOTADA'].includes(fila.estado));
      if (!visible) throw errores.noEncontrado('La publicación no existe.');
      return { producto: publico(fila, baseFotos) };
    },

    async mios({ usuario, baseFotos }) {
      const filas = await productosRepository.delProductor(usuario.id);
      return { productos: filas.map((f) => publico(f, baseFotos)) };
    },
  };
}

module.exports = { createProductosService, productoPublico };
