'use strict';

/**
 * Error de negocio con código HTTP y código estable para la app.
 * Formato de respuesta: { error: { codigo, mensaje, detalles? } } (docs/CONTRIBUTING.md).
 */
class HttpError extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'HttpError';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const errores = {
  datosInvalidos: (mensaje = 'Los datos enviados no son válidos.', detalles) => new HttpError(400, 'DATOS_INVALIDOS', mensaje, detalles),
  noAutenticado: (mensaje = 'Debe iniciar sesión.') => new HttpError(401, 'NO_AUTENTICADO', mensaje),
  sinPermiso: (mensaje = 'No tiene permiso para esta acción.') => new HttpError(403, 'SIN_PERMISO', mensaje),
  noEncontrado: (mensaje = 'El recurso no existe.') => new HttpError(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (codigo, mensaje, detalles) => new HttpError(409, codigo, mensaje, detalles),
  noDisponible: (mensaje = 'Servicio no disponible.') => new HttpError(503, 'NO_DISPONIBLE', mensaje),

  // Autenticación (CU-01, CU-21)
  sesionExpirada: (mensaje = 'La sesión expiró. Inicie sesión de nuevo.') => new HttpError(401, 'SESION_EXPIRADA', mensaje),
  credencialesInvalidas: () => new HttpError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas.'),
  cuentaBloqueada: (bloqueadoHasta, mensaje = 'Cuenta bloqueada temporalmente por intentos fallidos.') =>
    new HttpError(423, 'CUENTA_BLOQUEADA', mensaje, { bloqueadoHasta }),
  cuentaSuspendida: () => new HttpError(403, 'CUENTA_SUSPENDIDA', 'La cuenta está suspendida. Comuníquese con la asociación.'),
  cuentaExistente: (campo) =>
    new HttpError(409, 'CUENTA_EXISTENTE', campo === 'telefono'
      ? 'Ya existe una cuenta con ese celular. Inicie sesión.'
      : 'Ya existe una cuenta con ese correo. Inicie sesión.', { campo }),
};

module.exports = { HttpError, errores };
