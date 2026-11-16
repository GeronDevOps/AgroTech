/**
 * Catálogo de casos de prueba del MVP (Entrega 4, tabla "Casos de prueba del MVP", v2.1).
 * `modo` indica cómo se ejecuta cada caso en esta suite:
 *   api        → caja negra contra la API REST / WebSocket (proyecto "api")
 *   ui         → caja negra sobre la app en el navegador (proyecto "ui")
 *   api+ui     → ambos
 *   manual     → requiere personas o un teléfono real (piloto, APK con Firebase)
 * El reportero `reportero-cp.js` cruza este catálogo con las pruebas etiquetadas @CP-xx.
 */
module.exports = [
  { id: 'CP-01', cu: 'CU-01', tipo: 'Sistema', modo: 'api+ui', prueba: 'Registrar un usuario con datos válidos y autorización aceptada.', esperado: 'Cuenta creada con su rol; sesión abierta.' },
  { id: 'CP-02', cu: 'CU-01', tipo: 'Seguridad', modo: 'api', prueba: 'Iniciar sesión 5 veces con contraseña incorrecta.', esperado: 'Mensaje genérico y bloqueo de 15 minutos.' },
  { id: 'CP-03', cu: 'CU-02', tipo: 'Sistema', modo: 'api', prueba: 'Publicar un producto con foto, precio y cantidad.', esperado: 'Producto "Activo" visible en el catálogo.' },
  { id: 'CP-04', cu: 'CU-02, CU-17', tipo: 'Sistema', modo: 'ui', prueba: 'Publicar en modo avión y luego activar la red.', esperado: 'Queda "Pendiente" y se publica solo al volver la red.' },
  { id: 'CP-05', cu: 'CU-03', tipo: 'Rendimiento', modo: 'api+ui', prueba: 'Filtrar el catálogo por municipio con red 3G simulada.', esperado: 'Solo productos de ese municipio, en máximo 3 s.' },
  { id: 'CP-06', cu: 'CU-04', tipo: 'Sistema', modo: 'api', prueba: 'Confirmar un pedido con stock suficiente.', esperado: 'Stock descontado, pedido "Pendiente" y aviso al productor.' },
  { id: 'CP-07', cu: 'CU-04', tipo: 'Integración', modo: 'api', prueba: 'Dos consumidores compran al mismo tiempo la última unidad.', esperado: 'Solo se crea un pedido; el otro recibe el aviso de stock.' },
  { id: 'CP-08', cu: 'CU-13', tipo: 'Sistema', modo: 'api', prueba: 'Avanzar un pedido por todos sus estados e intentar saltar uno.', esperado: 'Cambios registrados con fecha; el salto se bloquea.' },
  { id: 'CP-09', cu: 'CU-05', tipo: 'Sistema', modo: 'api+ui', prueba: 'Enviar un mensaje en un pedido activo.', esperado: 'Llega en tiempo real con su hora.' },
  { id: 'CP-10', cu: 'CU-06', tipo: 'Sistema', modo: 'api+ui', prueba: 'Calificar dos veces el mismo pedido entregado.', esperado: 'Solo se guarda la primera calificación.' },
  { id: 'CP-11', cu: 'CU-07', tipo: 'Sistema', modo: 'api+ui', prueba: 'Consultar el panel con pedidos entregados en el mes.', esperado: 'Cifras iguales a la suma de los pedidos.' },
  { id: 'CP-12', cu: 'RNF-02', tipo: 'Usabilidad', modo: 'manual', prueba: 'Usuarios de la asociación publican y compran sin ayuda.', esperado: '≥ 80 % de éxito y SUS ≥ 68.', comoSeEjecuta: 'Piloto (docs/piloto/): guion de tareas y cuestionario SUS; npm run sus calcula el puntaje.' },
  { id: 'CP-13', cu: 'CU-10', tipo: 'Sistema', modo: 'api', prueba: 'Editar precio y cantidad de una publicación y luego llevar la cantidad a 0.', esperado: 'Catálogo actualizado; con 0 pasa a «Agotada»; los pedidos previos conservan su precio.' },
  { id: 'CP-14', cu: 'CU-15', tipo: 'Sistema', modo: 'api+ui', prueba: 'Consultar «Mis pedidos» con pedidos en distintos estados.', esperado: 'Aparecen los activos con su estado vigente.' },
  { id: 'CP-15', cu: 'CU-16', tipo: 'Sistema', modo: 'manual', prueba: 'Confirmar un pedido con la app del productor cerrada.', esperado: 'El productor recibe la notificación push y, al tocarla, se abre el pedido.', comoSeEjecuta: 'Requiere el APK con Firebase en un teléfono. La entrega a FCM, los reintentos y los tokens vencidos se prueban en api/tests/integration/push.test.js.' },
  { id: 'CP-16', cu: 'CU-04 · RNF-10', tipo: 'Integración', modo: 'api', prueba: 'Reenviar POST /api/v1/pedidos con la misma Idempotency-Key.', esperado: '200 con el mismo comprobante; un solo pedido; stock descontado una vez.' },
  { id: 'CP-17', cu: 'CU-17', tipo: 'Integración', modo: 'api+ui', prueba: 'Editar una publicación sin conexión mientras su versión cambia en el servidor y reconectar.', esperado: 'La operación queda «Con error» por conflicto; prevalece el servidor y se informa al usuario.' },
  { id: 'CP-18', cu: 'CU-22', tipo: 'Sistema', modo: 'api', prueba: 'Pagar en línea con la tarjeta aprobada y luego con la rechazada.', esperado: 'Aprobada: pago aprobado y el productor puede aceptar. Rechazada: se puede reintentar o cambiar a contra entrega.', comoSeEjecuta: 'Automático con eventos firmados con el secreto de pruebas (equivalentes a los del sandbox). El recorrido por la página de Wompi se hace a mano con las tarjetas de prueba del sandbox.' },
  { id: 'CP-19', cu: 'CU-22 · RNF-04', tipo: 'Seguridad', modo: 'api', prueba: 'Enviar a POST /api/v1/pagos/wompi/eventos un evento con la firma alterada y repetir un evento válido.', esperado: 'El alterado se rechaza (401) sin cambios; el repetido no se procesa dos veces.' },
  // --- Fase 2 del SRS (v1.1.0 · AGRO-22 … AGRO-29) ---
  { id: 'CP-20', cu: 'CU-08', tipo: 'Seguridad', modo: 'api+ui', prueba: 'Recuperar la contraseña con el código enviado al correo; probar código errado, vencido y contraseña débil.', esperado: 'Mensaje neutro; código de un solo uso (15 min, 3 intentos); nueva contraseña y sesiones anteriores cerradas.' },
  { id: 'CP-21', cu: 'CU-09', tipo: 'Sistema', modo: 'api+ui', prueba: 'Editar celular, municipio y ubicación del perfil; intentar un celular de otra cuenta y cambiar el rol.', esperado: 'Datos guardados con coordenadas recalculadas y bitácora; celular en uso y cambio de rol rechazados.' },
  { id: 'CP-22', cu: 'CU-20', tipo: 'Privacidad', modo: 'api+ui', prueba: 'Consultar los datos y la autorización; solicitar la supresión con y sin pedidos en curso.', esperado: 'Con pedidos en curso queda aplazada; sin ellos la cuenta se anonimiza, se cierra la sesión y los pedidos se conservan sin identificación.' },
  { id: 'CP-23', cu: 'CU-10', tipo: 'Sistema', modo: 'api+ui', prueba: 'Pausar, reactivar y retirar una publicación; retirar con un pedido en curso.', esperado: 'Pausada no aparece en el catálogo; retirar con pedidos en curso se bloquea; retirada conserva el histórico.' },
  { id: 'CP-24', cu: 'CU-11', tipo: 'Sistema', modo: 'api+ui', prueba: 'Buscar «cafe» y «ocanera» (sin tildes) y ordenar por precio; buscar algo inexistente.', esperado: 'Encuentra en nombre y descripción sin distinguir tildes; respeta el orden y los filtros; sin resultados sugiere categorías.' },
  { id: 'CP-25', cu: 'CU-12', tipo: 'Sistema', modo: 'api+ui', prueba: 'Activar «Cerca de mí» con la ubicación del teléfono y con la del perfil; fijar un radio sin productores.', esperado: 'Ordena de menor a mayor distancia mostrando los km; el radio filtra y propone ampliarlo.' },
  { id: 'CP-26', cu: 'CU-14', tipo: 'Integración', modo: 'api+ui', prueba: 'Cancelar un pedido aceptado; cancelar a la vez desde ambas partes; cancelar uno entregado.', esperado: 'Inventario restituido una sola vez, historial con motivo, chat en solo lectura, aviso a la contraparte; el entregado no se cancela.' },
  { id: 'CP-27', cu: 'CU-15', tipo: 'Sistema', modo: 'api+ui', prueba: 'Consultar el historial con filtros de estado (activos, finalizados) y de fechas.', esperado: 'Pedidos del más reciente al más antiguo según el filtro, con detalle, historial y acciones disponibles.' },
  { id: 'CP-28', cu: 'CU-16', tipo: 'Sistema', modo: 'api+ui', prueba: 'Aceptar, escribir y cancelar un pedido con la otra parte conectada.', esperado: 'Cada aviso llega en tiempo real y queda en la bandeja con lo necesario para abrir el pedido o el chat.', comoSeEjecuta: 'La entrega a FCM (app cerrada) requiere el APK en un teléfono; la bandeja y el WebSocket se prueban aquí.' },
  { id: 'CP-29', cu: 'CU-19', tipo: 'Sistema', modo: 'api+ui', prueba: 'Reportar una publicación y repetir el mismo reporte; motivo «Otro» sin descripción.', esperado: 'Reporte «Pendiente»; el repetido se informa en trámite; «Otro» exige descripción.' },
  { id: 'CP-30', cu: 'CU-18', tipo: 'Seguridad', modo: 'api+ui', prueba: 'Revisar un reporte en el panel y ocultar la publicación; suspender una cuenta con pedidos en curso; entrar al panel sin ser administrador.', esperado: 'Medida aplicada, registrada en bitácora y notificada; la suspensión pide confirmación y cierra la sesión; el acceso sin rol se niega y se registra.' },
];
