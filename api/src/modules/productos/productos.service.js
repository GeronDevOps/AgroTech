'use strict';

const crypto = require('node:crypto');
const { errores } = require('../../utils/http-error');
const { validarPublicacion, validarFotos, validarEdicion, validarFiltros, esUuid } = require('./productos.validacion');

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
      await almacenFotos.guardar(fotoClave, archivos.foto.buffer, 'image/jpeg');
      await almacenFotos.guardar(claveMiniatura(fotoClave), archivos.miniatura.buffer, 'image/jpeg');
      try {
        const creado = await productosRepository.insertar({ ...d, id, idProductor: usuario.id, fotoClave });
        const fila = await productosRepository.buscarPorId(id);
        if (!creado) return reintento(fila); // carrera entre dos reintentos simultáneos
        return { creado: true, producto: publico(fila, baseFotos) };
      } catch (err) {
        await almacenFotos.eliminar(fotoClave);
        await almacenFotos.eliminar(claveMiniatura(fotoClave));
        throw err;
      }

      function reintento(fila) {
        if (fila.id_productor !== usuario.id) throw errores.conflicto('ID_EN_USO', 'El identificador ya pertenece a otra publicación.');
        return { creado: false, producto: publico(fila, baseFotos) };
      }
    },

    /** RF-10a. 409 CONFLICTO_VERSION si otra edición ganó primero (CP-17); devuelve la versión vigente. */
    async editar({ usuario, id, cambios, baseFotos }) {
      const c = validarEdicion(cambios);
      const actual = esUuid(id) ? await productosRepository.buscarPorId(id) : null;
      if (!actual || actual.id_productor !== usuario.id || actual.estado === 'INACTIVA') {
        throw errores.noEncontrado('La publicación no existe.');
      }
      const ok = await productosRepository.actualizarPrecioStock(id, usuario.id, c);
      if (!ok) {
        const vigente = await productosRepository.buscarPorId(id);
        throw errores.conflicto(
          'CONFLICTO_VERSION',
          'La publicación cambió mientras la editaba. Revise los datos actuales.',
          { producto: publico(vigente, baseFotos) },
        );
      }
      return { producto: publico(await productosRepository.buscarPorId(id), baseFotos) };
    },

    /** CU-03: página del catálogo con filtros. */
    async catalogo({ query, baseFotos }) {
      const f = validarFiltros(query);
      const { filas, total } = await productosRepository.catalogo(f);
      const totalReal = total ?? (f.pagina === 1 ? 0 : await productosRepository.contarCatalogo(f));
      return {
        productos: filas.map((fila) => publico(fila, baseFotos)),
        pagina: f.pagina,
        tamano: f.tamano,
        total: totalReal,
        hayMas: f.pagina * f.tamano < totalReal,
      };
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
