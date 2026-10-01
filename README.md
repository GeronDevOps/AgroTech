# AgroTech
Proyecto AgroTech
# 🌱 AgroTech

### Plataforma móvil para la comercialización directa de productos agrícolas en Norte de Santander

AgroTech es una aplicación móvil orientada a conectar **productores agrícolas rurales** con **consumidores urbanos**, facilitando la comercialización directa de productos agrícolas y reduciendo la dependencia de intermediarios.

El proyecto contempla un **Producto Mínimo Viable (MVP)** con catálogo de productos, gestión de inventario, pedidos, comunicación entre usuarios, calificaciones y herramientas básicas de seguimiento de ventas.

> **Estado:** 🚧 En desarrollo — MVP
> **Contexto:** Proyecto académico de Ingeniería de Software II
> **Universidad de Pamplona — 2026**

---

## 📌 Descripción

Los productores agrícolas pueden encontrar dificultades para comercializar sus productos directamente, especialmente cuando existen barreras geográficas, de conectividad y de acceso a herramientas digitales.

AgroTech propone una plataforma móvil que permita:

* Publicar productos agrícolas disponibles.
* Gestionar inventario y precios.
* Consultar productos por categoría y municipio.
* Realizar pedidos.
* Establecer comunicación directa entre productor y consumidor.
* Consultar el estado de los pedidos.
* Calificar a los productores.
* Consultar indicadores básicos de ventas.
* Trabajar con conectividad intermitente mediante almacenamiento local y sincronización.
* Utilizar información geográfica para priorizar productores cercanos.

El sistema está diseñado teniendo especialmente en cuenta las condiciones de conectividad y usabilidad presentes en entornos rurales.



## 🎯 Objetivo

Desarrollar y desplegar un **Producto Mínimo Viable de una aplicación móvil para la comercialización directa de productos agrícolas en Norte de Santander**, integrando un catálogo de productos y un módulo para la gestión y concertación de pedidos.

### Objetivos específicos

* Definir los requisitos funcionales, no funcionales y de información.
* Diseñar una arquitectura orientada a usabilidad, eficiencia y sincronización asíncrona.
* Implementar el sistema mediante un proceso de desarrollo ágil basado en Kanban.
* Validar el producto mediante pruebas funcionales y de calidad.
* Considerar las condiciones de conectividad de los usuarios rurales.
* Medir el desempeño del proyecto y la calidad del producto durante las iteraciones.

---

## 👥 Usuarios del sistema

### 👨‍🌾 Productor agrícola

Usuario encargado de:

* Publicar productos.
* Gestionar precios y cantidades disponibles.
* Administrar su inventario.
* Recibir y gestionar pedidos.
* Comunicarse con consumidores.
* Consultar sus ventas.

### 🛒 Consumidor final

Usuario encargado de:

* Explorar el catálogo.
* Buscar y filtrar productos.
* Agregar productos al carrito.
* Realizar pedidos.
* Comunicarse con productores.
* Consultar el historial de pedidos.
* Calificar el servicio recibido.

### 🛡️ Administrador

Responsable de funciones de administración y moderación, incluyendo:

* Gestión de reportes.
* Moderación de contenido.
* Gestión de cuentas.
* Verificación de productores.
* Supervisión de incumplimientos.
* Gestión relacionada con privacidad y datos personales.



# 🚀 Funcionalidades

## MVP

El alcance base del MVP contempla las siguientes funcionalidades principales:

| Módulo             | Descripción                                           |
| ----------------   | ----------------------------------------------------  |
| 🔐 Autenticación  | Registro e inicio de sesión con roles                 |
| 📦 Inventario     | Publicación y gestión de productos agrícolas          |
| 🛍️ Catálogo       | Consulta y filtrado de productos                      |
| 🛒 Pedidos        | Carrito, confirmación y gestión de pedidos            |
| 💬 Comunicación   | Chat interno entre productor y consumidor             |
| ⭐ Calificaciones | Evaluación del productor después de la entrega        |
| 📊 Ventas         | Consulta de indicadores e historial de ventas         |
| 📡 Offline        | Consulta local y sincronización al recuperar conexión |

### Funcionalidades contempladas

La especificación del sistema también contempla funcionalidades adicionales que pueden incorporarse progresivamente al producto:

* Recuperación de contraseña.
* Gestión de perfiles.
* Pausar, editar y retirar publicaciones.
* Búsqueda y ordenamiento avanzado.
* Ordenamiento por cercanía.
* Gestión del ciclo de estados de los pedidos.
* Cancelación de pedidos.
* Historial detallado de pedidos.
* Notificaciones push.
* Moderación de contenido.
* Reportes de usuarios.
* Gestión de autorización y supresión de datos personales.

Estas funcionalidades forman parte de la especificación general y su incorporación al MVP se gestionará de acuerdo con las prioridades y capacidad del equipo.



# 🏗️ Arquitectura

AgroTech utiliza una arquitectura cliente-servidor desacoplada.

```text
┌───────────────────────────────────────────┐
│              PRESENTACIÓN                 │
│                                           │
│       Aplicación móvil React Native       │
│       Panel de administración web         │
│       Caché / almacenamiento local        │
└─────────────────────┬─────────────────────┘
                      │
              HTTPS / WebSocket
                      │
┌─────────────────────▼─────────────────────┐
│              APLICACIÓN                   │
│                                           │
│             Backend Node.js               │
│                                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Auth     │ │ Catálogo │ │ Pedidos   │ │
│  ├──────────┤ ├──────────┤ ├───────────┤ │
│  │ Usuarios │ │ Ventas   │ │ Moderación│ │
│  ├──────────┤ ├──────────┤ ├───────────┤ │
│  │ Chat     │ │ Rating   │ │ Privacidad│ │
│  └──────────┘ └──────────┘ └───────────┘ │
│                                           │
│          REST API + WebSockets            │
└─────────────────────┬─────────────────────┘
                      │
┌─────────────────────▼─────────────────────┐
│                  DATOS                    │
│                                           │
│         PostgreSQL + PostGIS              │
│                                           │
│      Usuarios · Productos · Pedidos       │
│      Mensajes · Calificaciones            │
└───────────────────────────────────────────┘

              ┌──────────────────┐
              │ Servicios        │
              │ externos         │
              ├──────────────────┤
              │ Push             │
              │ Correo           │
              │ Imágenes         │
              │ Geolocalización  │
              └──────────────────┘
```

---

# 🧰 Stack tecnológico

## Aplicación móvil

* **React Native**
* JavaScript
* Almacenamiento local / caché
* Sincronización asíncrona

## Backend

* **Node.js**
* API REST
* JWT
* WebSockets
* Bcrypt

## Base de datos

* **PostgreSQL**
* **PostGIS**

PostGIS permitirá gestionar información geográfica y realizar cálculos de distancia entre productores y consumidores.

## Control y gestión

* **Git**
* **GitHub**
* **Jira**
* **Kanban**

---

# 🔐 Seguridad

La especificación contempla diferentes mecanismos de seguridad:

* Autenticación mediante JWT.
* Contraseñas almacenadas utilizando hashing seguro mediante Bcrypt.
* Control de acceso según roles.
* Bloqueo temporal después de múltiples intentos de autenticación fallidos.
* Comunicación mediante HTTPS.
* Gestión de sesiones.
* Registro de operaciones relevantes mediante bitácora.
* Tratamiento de datos personales.
* Mecanismos relacionados con autorización, consulta, corrección y supresión de información personal.

---

# 📡 Funcionamiento sin conexión

Una característica importante de AgroTech es la capacidad de trabajar en escenarios con conectividad intermitente.

Cuando el dispositivo pierde conexión:

1. La aplicación detecta la ausencia de red.
2. Activa el modo offline.
3. Permite consultar información almacenada localmente.
4. Registra determinadas operaciones en una cola local.
5. Al recuperar la conexión, las operaciones pendientes se sincronizan.
6. El servidor valida las operaciones.
7. La aplicación actualiza la información local.

Las operaciones que requieren comunicación inmediata con el servidor, como determinadas transacciones de pedidos y cambios de estado, pueden quedar bloqueadas mientras no exista conexión.

---

# 🗄️ Modelo de datos

El modelo relacional contempla principalmente las siguientes entidades:

```text
Usuarios
   │
   ├─────────────── Productos
   │
   └─────────────── Pedidos
                         │
                         └── Detalle_Pedidos
                         
Pedidos
   │
   ├─────────────── Mensajes_Chat
   │
   └─────────────── Calificaciones
```

### Entidades principales

* `Usuarios`
* `Productos`
* `Pedidos`
* `Detalle_Pedidos`
* `Mensajes_Chat`
* `Calificaciones`

El diseño busca mantener la integridad referencial y soportar las operaciones transaccionales relacionadas con inventario y pedidos.

---

# 🔄 Flujo principal de compra

```text
Consumidor
    │
    ▼
Explora catálogo
    │
    ▼
Selecciona productos
    │
    ▼
Agrega al carrito
    │
    ▼
Confirma pedido
    │
    ▼
Backend valida stock
    │
    ├── Stock insuficiente
    │       └── Rechaza operación
    │
    └── Stock disponible
            │
            ▼
      Reserva/descuenta stock
            │
            ▼
       Crea pedido
            │
            ▼
      Notifica productor
            │
            ▼
       Gestiona entrega
            │
            ▼
          Entregado
            │
            ▼
       Calificación
```

---

# 📋 Requisitos funcionales principales

| ID    | Funcionalidad         | Prioridad |
| ----- | --------------------- | --------- |
| RF-01 | Autenticación         | Alta      |
| RF-02 | Gestión de inventario | Alta      |
| RF-03 | Catálogo              | Alta      |
| RF-04 | Pedidos               | Alta      |
| RF-05 | Comunicación          | Media     |
| RF-06 | Calificaciones        | Media     |
| RF-07 | Reportes de ventas    | Media     |

---

# ⚙️ Requisitos no funcionales

Entre los principales requisitos de calidad definidos se encuentran:

### Rendimiento

El catálogo debe tener un tiempo de carga máximo de referencia de **3 segundos bajo una conexión 3G**.

### Usabilidad

La interfaz debe utilizar:

* Íconos grandes.
* Alto contraste.
* Navegación sencilla.
* Flujos minimalistas.

### Disponibilidad

La aplicación debe soportar consultas temporales mediante almacenamiento local cuando exista conectividad intermitente.

### Seguridad

Las contraseñas deben almacenarse utilizando mecanismos de hashing seguro como Bcrypt.

---

# 🧪 Pruebas y calidad

El proyecto contempla pruebas funcionales, pruebas de caja negra y pruebas de usabilidad.

Los criterios de aceptación definidos incluyen validaciones para:

* Registro e inicio de sesión.
* Publicación de productos.
* Funcionamiento offline.
* Confirmación de pedidos.
* Comunicación mediante chat.
* Manejo de credenciales inválidas.

### Métricas de calidad

Se contemplan, entre otras:

* Densidad de errores.
* Densidad de defectos.
* EED (Error Effectiveness Detection).
* Porcentaje de criterios de aceptación aprobados.
* Tiempo de carga del catálogo.
* SUS (System Usability Scale).
* Tasa de éxito en tareas críticas.
* Disponibilidad.
* Tasa de sincronización sin errores.
* Vulnerabilidades críticas.
* Tiempo medio de corrección de errores.

Algunas metas definidas en el documento incluyen:

| Métrica                        | Meta        |
| ------------------------------ | ----------- |
| Carga del catálogo             | ≤ 3 s en 3G |
| SUS                            | ≥ 68        |
| Éxito en tareas críticas       | ≥ 80 %      |
| Sincronización sin errores     | ≥ 98 %      |
| Disponibilidad durante piloto  | ≥ 99 %      |
| EED                            | ≥ 0,90      |
| Vulnerabilidades críticas      | 0           |
| Corrección de errores críticos | ≤ 48 h      |

---

# 📊 Gestión del proyecto

AgroTech utiliza un flujo de trabajo basado en **Kanban**.

### Flujo

```text
┌─────────┐
│ To Do   │
└────┬────┘
     │
     ▼
┌─────────────┐
│ In Progress │
└──────┬──────┘
       │
       ▼
┌────────────┐
│ QA / Review│
└──────┬─────┘
       │
       ▼
┌─────────┐
│  Done   │
└─────────┘
```

### Herramientas

* **Jira:** gestión de tareas, backlog y flujo Kanban.
* **GitHub:** repositorio y control de versiones.
* **Git:** estrategia de ramas y control del código.
* **Pull Requests:** revisión y trazabilidad del desarrollo.

Se busca mantener una relación entre las tareas de Jira y los Pull Requests correspondientes.

---

# 👨‍💻 Equipo

| Integrante                     | Rol principal      | Rol secundario     |
| ------------------------------ | ------------------ | ------------------ |
| Julio Sebastian Carrillo Reyes | Project Manager    | Software Architect |
| Julio Leandro Duran Pacheco    | Frontend Developer | QA / Tester        |
| Geron José Vergara García      | Backend Developer  | DevOps             |

### Responsabilidades

**Project Manager / Software Architect**

* Gestión del proyecto.
* Administración del backlog.
* Seguimiento de tareas.
* Arquitectura del sistema.
* Decisiones tecnológicas.

**Frontend Developer / QA**

* Desarrollo de la aplicación móvil.
* Diseño de interfaces.
* Usabilidad y accesibilidad.
* Pruebas funcionales.
* Pruebas de calidad.

**Backend Developer / DevOps**

* Desarrollo de la API.
* Diseño de base de datos.
* Lógica de negocio.
* Administración del repositorio.
* Entornos de prueba y despliegue.

---

# ⚠️ Gestión de riesgos

El proyecto contempla un Plan de Reducción, Supervisión y Gestión del Riesgo (RSGR).

Entre los riesgos identificados se encuentran:

* Intermitencia o caída de conectividad rural.
* Baja alfabetización digital.
* Inexperiencia en React Native.
* Alcance del MVP superior a la capacidad del equipo.
* Ausencia o baja dedicación de un integrante.
* Cambios de requisitos.
* Inconsistencias de inventario.
* Incompatibilidad con smartphones antiguos.
* Participación insuficiente de productores.
* Riesgos relacionados con el tratamiento de datos personales.

La exposición al riesgo se calcula mediante:

```text
ER = P × C
```

donde:

* `P` = probabilidad de ocurrencia.
* `C` = costo estimado de las consecuencias en semanas.

El documento establece una línea de corte de:

```text
ER ≥ 1.0
```

para los riesgos que requieren un plan formal de reducción, supervisión y gestión.

---

# 📏 Métricas del proyecto

El proyecto utiliza **Puntos de Función (PF)** como medida orientada a la funcionalidad.

También se contemplan:

* Esfuerzo en persona-mes.
* Productividad.
* Tiempo de ciclo.
* Throughput.
* WIP.
* Avance real.
* Desviación del esfuerzo.
* Trazabilidad entre Jira y GitHub.

Las métricas son consideradas inicialmente como valores de planificación y deberán recalibrarse con datos reales obtenidos durante las iteraciones.

---

# 🗺️ Roadmap

### Fase 1 — Fundamentos

* [ ] Configuración del repositorio.
* [ ] Configuración del proyecto React Native.
* [ ] Configuración del backend Node.js.
* [ ] Configuración de PostgreSQL.
* [ ] Configuración del entorno de desarrollo.
* [ ] Definición de ramas y flujo Git.

### Fase 2 — Autenticación

* [ ] Registro.
* [ ] Inicio de sesión.
* [ ] Roles Productor / Consumidor.
* [ ] JWT.
* [ ] Hashing de contraseñas.
* [ ] Recuperación de contraseña.

### Fase 3 — Productos y catálogo

* [ ] Publicación de productos.
* [ ] Gestión de inventario.
* [ ] Carga de fotografías.
* [ ] Catálogo.
* [ ] Filtros.
* [ ] Búsqueda.
* [ ] Ordenamiento.

### Fase 4 — Pedidos

* [ ] Carrito.
* [ ] Confirmación de pedidos.
* [ ] Control de inventario.
* [ ] Estados del pedido.
* [ ] Cancelación.
* [ ] Historial.

### Fase 5 — Comunicación

* [ ] Chat.
* [ ] WebSockets.
* [ ] Notificaciones.
* [ ] Eventos relacionados con pedidos.

### Fase 6 — Calidad y piloto

* [ ] Pruebas funcionales.
* [ ] Pruebas de usabilidad.
* [ ] Pruebas de conectividad intermitente.
* [ ] Medición de métricas.
* [ ] Corrección de errores.
* [ ] Piloto con usuarios.

---

# 🚧 Limitaciones actuales

La primera versión del sistema **no contempla una pasarela de pagos bancaria integrada**.

Las transacciones del MVP se plantean mediante:

* Pago contra entrega.
* Acuerdos externos entre comprador y productor.

Además, algunas funcionalidades especificadas en el documento general pueden ser incorporadas posteriormente dependiendo del alcance definitivo del MVP.

---

# 📚 Documentación

La documentación completa del proyecto incluye:

* Especificación de Requisitos de Software (SRS).
* Requisitos funcionales.
* Requisitos no funcionales.
* Requisitos de información.
* Casos de uso.
* Requisitos de aceptación.
* Modelo entidad-relación.
* Diagramas de arquitectura.
* Diagrama de despliegue.
* Diagrama de secuencia.
* Plan de gestión de riesgos.
* Métricas del proyecto y proceso.
* Métricas de calidad.
* Referencias bibliográficas.

---

# 🎓 Contexto académico

**Proyecto:** AgroTech
**Asignatura:** Ingeniería de Software II
**Código:** 167415
**Institución:** Universidad de Pamplona
**Facultad:** Ingenierías y Arquitecturas
**Año:** 2026

---

# 👨‍💻 Autores

**Julio Sebastian Carrillo Reyes**
Project Manager / Software Architect

**Julio Leandro Duran Pacheco**
Frontend Developer / QA Tester

**Geron José Vergara García**
Backend Developer / DevOps

---

# 📄 Licencia

Este proyecto se desarrolla con fines académicos dentro del contexto de la asignatura **Ingeniería de Software II** de la Universidad de Pamplona.

La licencia definitiva del código será definida por el equipo antes de realizar una distribución pública del software.

---

## 🌱 AgroTech

> Tecnología para conectar directamente el campo con quienes consumen sus productos.
