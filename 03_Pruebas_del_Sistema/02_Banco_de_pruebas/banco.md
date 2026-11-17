# Banco de pruebas del sistema · AgroTech v1.1.0 · resultado de la ejecución

- **Fecha:** 2026-11-16T07:22:31.152Z
- **Casos:** 103 (100 automatizados, 3 manuales del piloto)
- **Resultado:** PASA 100 · FALLA 0 · OMITIDO 0 · NO EJECUTADO 0
- **Evidencias:** 555 llamadas HTTP registradas · 21 capturas

| ID | Módulo | Requisito | Técnica | Nivel | Caso | Resultado | Tiempo |
|---|---|---|---|---|---|---|---|
| BP-001 | Cuentas | RF-01, RNF-05 | Partición de equivalencia | API | Registro válido de un productor | PASA | 0.3 s |
| BP-002 | Cuentas | RNF-05 | Tabla de decisión | API | Registro sin autorizar el tratamiento de datos | PASA | 0.2 s |
| BP-003 | Cuentas | RF-01 | Partición de equivalencia | API | Registro con un correo ya usado | PASA | 0.2 s |
| BP-004 | Cuentas | RF-01 | Valores límite | API | Celular con formato inválido | PASA | 0.0 s |
| BP-005 | Cuentas | RF-01, RF-18 | Pruebas de seguridad | API | Registro intentando el rol ADMINISTRADOR | PASA | 0.1 s |
| BP-006 | Cuentas | RNF-04 | Valores límite | API | Política de contraseñas | PASA | 0.2 s |
| BP-007 | Cuentas | RF-01 | Partición de equivalencia | API | Inicio de sesión por correo y por celular | PASA | 0.4 s |
| BP-008 | Cuentas | RNF-04 | Pruebas de seguridad | API | Contraseña errada con mensaje genérico | PASA | 0.4 s |
| BP-009 | Cuentas | RNF-04 | Valores límite | API | Bloqueo tras 5 intentos fallidos | PASA | 1.1 s |
| BP-010 | Cuentas | RNF-04 | Pruebas de seguridad | API | Rutas protegidas sin token o con token alterado | PASA | 0.1 s |
| BP-011 | Cuentas | RNF-04 | Pruebas de seguridad | API | Las respuestas no exponen la contraseña ni su hash | PASA | 0.2 s |
| BP-012 | Cuentas | RF-08 | Pruebas de seguridad | API | Recuperación con respuesta neutra | PASA | 0.3 s |
| BP-013 | Cuentas | RF-08 | Valores límite | API | Tres códigos errados invalidan el código | PASA | 0.6 s |
| BP-014 | Cuentas | RF-08 | Flujo de caso de uso | API | Restablecer cierra las sesiones y el código es de un solo uso | PASA | 0.4 s |
| BP-015 | Cuentas | RF-08 | Valores límite | API | Formato del código de recuperación | PASA | 0.0 s |
| BP-016 | Perfil | RF-09 | Flujo de caso de uso | API | Cambiar el municipio recalcula las coordenadas | PASA | 0.1 s |
| BP-017 | Perfil | RF-09, RF-12 | Valores límite | API | Ubicación fuera de Norte de Santander | PASA | 0.1 s |
| BP-018 | Perfil | RF-09 | Pruebas de seguridad | API | El rol no se cambia desde el perfil | PASA | 0.1 s |
| BP-019 | Perfil | RF-09 | Partición de equivalencia | API | Correo de otra cuenta | PASA | 0.2 s |
| BP-020 | Privacidad | RF-20, RNF-05 | Flujo de caso de uso | API | Consultar datos, finalidades y autorización | PASA | 0.1 s |
| BP-021 | Privacidad | RF-20 | Tabla de decisión | API | La supresión exige confirmar las consecuencias | PASA | 0.1 s |
| BP-022 | Privacidad | RF-20 | Transición de estados | API | Supresión aplazada, repetida y desistida | PASA | 0.2 s |
| BP-023 | Privacidad | RF-20 | Flujo de caso de uso | API | Supresión completa: anonimiza y conserva la transacción | PASA | 0.5 s |
| BP-024 | Inventario | RF-02 | Flujo de caso de uso | API | Publicar con foto y miniatura | PASA | 0.3 s |
| BP-025 | Inventario | RF-02 | Partición de equivalencia | API | Publicar sin foto | PASA | 0.2 s |
| BP-026 | Inventario | RF-02 | Valores límite | API | Precio mínimo ($50) | PASA | 0.2 s |
| BP-027 | Inventario | RF-02 | Valores límite | API | Precio máximo ($50.000.000) | PASA | 0.2 s |
| BP-028 | Inventario | RF-02 | Valores límite | API | Cantidad al publicar | PASA | 0.2 s |
| BP-029 | Inventario | RF-02, RNF-04 | Pruebas de seguridad | API | Un consumidor no puede publicar | PASA | 0.2 s |
| BP-030 | Catálogo | RF-03 | Partición de equivalencia | API | Filtros por municipio y categoría | PASA | 0.5 s |
| BP-031 | Catálogo | RF-03 | Valores límite | API | Rango de precio invertido | PASA | 0.1 s |
| BP-032 | Catálogo | RF-03 | Valores límite | API | Tamaño de página | PASA | 0.2 s |
| BP-033 | Inventario | RF-10 | Concurrencia | API | Edición con versión desactualizada | PASA | 0.2 s |
| BP-034 | Inventario | RF-10 | Transición de estados | API | Cantidad 0 → Agotada y vuelta a Activa | PASA | 0.3 s |
| BP-035 | Inventario | RF-10 | Transición de estados | API | Pausar y reactivar | PASA | 0.4 s |
| BP-036 | Inventario | RF-10 | Tabla de decisión | API | Retirar con un pedido en curso | PASA | 0.3 s |
| BP-037 | Inventario | RF-10 | Transición de estados | API | Transición de estado no permitida | PASA | 0.2 s |
| BP-038 | Inventario | RF-10, RNF-04 | Pruebas de seguridad | API | Otro productor no puede editar la publicación | PASA | 0.2 s |
| BP-039 | Catálogo | RF-11 | Partición de equivalencia | API | Búsqueda sin tildes ni mayúsculas en nombre y descripción | PASA | 0.3 s |
| BP-040 | Catálogo | RF-11 | Valores límite | API | Búsqueda con menos de 3 caracteres | PASA | 0.2 s |
| BP-041 | Catálogo | RF-11 | Partición de equivalencia | API | Orden por precio descendente conservando filtros | PASA | 0.3 s |
| BP-042 | Catálogo | RF-11 | Partición de equivalencia | API | Orden desconocido | PASA | 0.1 s |
| BP-043 | Catálogo | RF-11 | Flujo de caso de uso | API | Sin coincidencias sugiere categorías | PASA | 0.2 s |
| BP-044 | Catálogo | RF-12 | Flujo de caso de uso | API | «Cerca de mí» con la ubicación del teléfono | PASA | 0.5 s |
| BP-045 | Catálogo | RF-12 | Valores límite | API | Valores límite del radio | PASA | 0.1 s |
| BP-046 | Catálogo | RF-12 | Flujo de caso de uso | API | Radio sin productores propone ampliarlo | PASA | 0.1 s |
| BP-047 | Pedidos | RF-04 | Flujo de caso de uso | API | Confirmar un pedido descuenta el inventario | PASA | 0.4 s |
| BP-048 | Pedidos | RF-04 | Valores límite | API | Cantidad mayor al inventario | PASA | 0.4 s |
| BP-049 | Pedidos | RF-04 | Conjetura de errores | API | Idempotencia de la confirmación | PASA | 0.3 s |
| BP-050 | Pedidos | RF-04, RNF-04 | Pruebas de seguridad | API | Un productor no puede comprar | PASA | 0.2 s |
| BP-051 | Pedidos | RF-04 | Partición de equivalencia | API | Carrito con dos productores genera un pedido por productor | PASA | 0.5 s |
| BP-052 | Pedidos | RF-13 | Transición de estados | API | Ciclo completo de estados con historial | PASA | 0.4 s |
| BP-053 | Pedidos | RF-13 | Transición de estados | API | Transición no permitida | PASA | 0.3 s |
| BP-054 | Pedidos | RF-13 | Tabla de decisión | API | Rechazo exige motivo y restituye inventario | PASA | 0.4 s |
| BP-055 | Pedidos | RF-13, RNF-04 | Pruebas de seguridad | API | El consumidor no cambia el estado | PASA | 0.3 s |
| BP-056 | Pedidos | RF-14 | Flujo de caso de uso | API | Cancelar un pedido aceptado | PASA | 0.5 s |
| BP-057 | Pedidos | RF-14 | Concurrencia | API | Cancelaciones simultáneas | PASA | 0.4 s |
| BP-058 | Pedidos | RF-14 | Transición de estados | API | Un pedido entregado no se cancela | PASA | 0.5 s |
| BP-059 | Pedidos | RF-15, RNF-04 | Pruebas de seguridad | API | Un tercero no ve ni cancela un pedido ajeno | PASA | 0.5 s |
| BP-060 | Pedidos | RF-15 | Partición de equivalencia | API | Historial con filtros de estado y fechas | PASA | 0.5 s |
| BP-061 | Pagos | RF-21 | Flujo de caso de uso | API | Pago en línea aprobado por la pasarela | PASA | 0.2 s |
| BP-062 | Pagos | RF-21, RNF-04 | Pruebas de seguridad | API | Evento de pago con firma inválida | PASA | 0.2 s |
| BP-063 | Pagos | RF-21 | Tabla de decisión | API | No se acepta un pedido en línea sin pago aprobado | PASA | 0.2 s |
| BP-064 | Comunicación | RF-05 | Flujo de caso de uso | API | Mensaje entregado en tiempo real | PASA | 0.3 s |
| BP-065 | Comunicación | RF-05 | Valores límite | API | Longitud del mensaje | PASA | 0.2 s |
| BP-066 | Comunicación | RF-05, RNF-04 | Pruebas de seguridad | API | Un tercero no lee ni escribe en el chat | PASA | 0.4 s |
| BP-067 | Calificación | RF-06 | Transición de estados | API | Calificar antes de la entrega | PASA | 0.3 s |
| BP-068 | Calificación | RF-06 | Valores límite | API | Puntuación de 1 a 5 y una sola vez | PASA | 0.3 s |
| BP-069 | Ventas | RF-07 | Flujo de caso de uso | API | Panel de ventas del productor | PASA | 0.3 s |
| BP-070 | Avisos | RF-16 | Flujo de caso de uso | API | Avisos de estado en la bandeja | PASA | 0.2 s |
| BP-071 | Avisos | RF-16 | Flujo de caso de uso | API | El aviso de un mensaje abre el chat | PASA | 0.2 s |
| BP-072 | Sincronización | RF-17 | Conjetura de errores | API | Operación sin señal publicada e idempotente | PASA | 0.1 s |
| BP-073 | Sincronización | RF-17 | Concurrencia | API | Conflicto de edición: prevalece el servidor | PASA | 0.1 s |
| BP-074 | Sincronización | RF-17 | Flujo de caso de uso | API | Descarga incremental | PASA | 0.2 s |
| BP-075 | Sincronización | RNF-03 | Pruebas de rendimiento | API | ≥ 98 % de operaciones sincronizadas sin error | PASA | 0.9 s |
| BP-076 | Reportes | RF-19 | Flujo de caso de uso | API | Reportar una publicación y repetirlo | PASA | 0.4 s |
| BP-077 | Reportes | RF-19 | Valores límite | API | «Otro» exige descripción | PASA | 0.5 s |
| BP-078 | Reportes | RF-19 | Conjetura de errores | API | No se reporta el contenido propio | PASA | 0.1 s |
| BP-079 | Administración | RF-18, RNF-04 | Pruebas de seguridad | API | Acceso al panel sin el rol de administrador | PASA | 0.7 s |
| BP-080 | Administración | RF-18 | Flujo de caso de uso | API | Ocultar una publicación reportada | PASA | 0.9 s |
| BP-081 | Administración | RF-18 | Tabla de decisión | API | Suspender con pedidos en curso | PASA | 0.8 s |
| BP-082 | Administración | RF-18 | Flujo de caso de uso | API | Verificar un productor | PASA | 0.4 s |
| BP-083 | Administración | RF-18 | Flujo de caso de uso | API | Reporte malintencionado | PASA | 0.6 s |
| BP-084 | No funcional | RNF-01 | Pruebas de rendimiento | API | Tiempo de respuesta del catálogo | PASA | 1.3 s |
| BP-085 | No funcional | RNF-04 | Pruebas de seguridad | API | Cabeceras de seguridad | PASA | 0.0 s |
| BP-086 | No funcional | RNF-04 | Pruebas de seguridad | API | Intentos de inyección SQL | PASA | 0.3 s |
| BP-087 | No funcional | RNF-04 | Pruebas de seguridad | API | Cuerpo demasiado grande | PASA | 0.0 s |
| BP-088 | No funcional | RNF-07 | Flujo de caso de uso | API | Estado de salud del servicio | PASA | 0.1 s |
| BP-089 | Interfaz | RF-01, RNF-05 | Flujo de caso de uso | UI | Registro desde la app exige la autorización | PASA | 4.2 s |
| BP-090 | Interfaz | RF-01 | Partición de equivalencia | UI | Contraseña errada en la app | PASA | 1.5 s |
| BP-091 | Interfaz | RF-03 | Partición de equivalencia | UI | Filtrar el catálogo por categoría | PASA | 3.0 s |
| BP-092 | Interfaz | RF-04 | Flujo de caso de uso | UI | Agregar al carrito y confirmar el pedido | PASA | 4.1 s |
| BP-093 | Interfaz | RF-17, RNF-03 | Flujo de caso de uso | UI | Catálogo sin conexión desde la copia local | PASA | 4.3 s |
| BP-094 | Interfaz | RF-11 | Flujo de caso de uso | UI | Buscar y ver sugerencias | PASA | 3.0 s |
| BP-095 | Interfaz | RF-14 | Flujo de caso de uso | UI | Cancelar un pedido desde la app | PASA | 3.3 s |
| BP-096 | Interfaz | RF-09 | Valores límite | UI | Datos inválidos en «Mi perfil» | PASA | 2.2 s |
| BP-097 | Interfaz | RF-10 | Tabla de decisión | UI | Retirar con pedidos en curso desde la app | PASA | 3.1 s |
| BP-098 | Interfaz | RF-18 | Flujo de caso de uso | UI | Verificar un productor desde el panel web | PASA | 3.6 s |
| BP-099 | Interfaz | RF-16 | Flujo de caso de uso | UI | Contador de avisos sin leer | PASA | 2.7 s |
| BP-100 | Interfaz | RNF-02 | Conjetura de errores | UI | Áreas táctiles mínimas en el inicio | PASA | 2.7 s |
| BP-101 | Piloto | RNF-02 | Flujo de caso de uso | MANUAL | Usabilidad con productores (SUS) | PENDIENTE (piloto) | — |
| BP-102 | Piloto | RF-16 | Flujo de caso de uso | MANUAL | Push con la app cerrada | PENDIENTE (piloto) | — |
| BP-103 | Piloto | RNF-06 | Conjetura de errores | MANUAL | Funcionamiento en Android de gama baja | PENDIENTE (piloto) | — |
