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
];
