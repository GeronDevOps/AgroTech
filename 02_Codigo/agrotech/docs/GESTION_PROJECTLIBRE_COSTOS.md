# Gestión del proyecto, cronograma y presupuesto · AgroTech

| Campo | Valor |
|---|---|
| Versión | 2.3 · 18 de noviembre de 2026 (fecha de estado) |
| Proyecto | Desarrollo de una aplicación móvil para la comercialización directa de productos agrícolas en Norte de Santander · Ingeniería de Software II (167415), Universidad de Pamplona |
| Equipo | Julio Carrillo (Project Manager / Software Architect) · Julio Durán (Frontend Developer / QA Tester) · Geron Vergara (Backend Developer / DevOps) |
| Periodo | 01/09/2026 – 03/12/2026 (cierre planificado) · fecha límite 10/12/2026 |
| Cronograma fuente | `01_Documentacion/03_Gestion/AgroTech_Cronograma.xml` (v2.2, formato MSPDI que ProjectLibre abre e importa; no se modificó) |
| Cronograma actualizado | `01_Documentacion/03_Gestion/proyecto_agrotech_actualizado.xml` (v2.3, con costos y avance al 18/11) |
| Documentos relacionados | Entrega 4 (Plan de gestión, capítulos 3–5) · `docs/PLAN_DESARROLLO.md` · `docs/pruebas/PLAN_Y_DISENO_PRUEBAS.md` · `docs/pruebas/INFORME_EJECUCION_PRUEBAS.md` · `RESUMEN_REVISION_CODIGO.md` · `docs/despliegue/RUNBOOK.md` §8 |
## 1. Fuente del cronograma y hallazgos de la inspección

Al iniciar esta revisión, `01_Documentacion/03_Gestion` tenía **dos archivos y ningún `.pod`**: `AgroTech_Cronograma.xml` (proyecto de ProjectLibre guardado en formato XML de Microsoft Project, *MSPDI*) y `gantt.png` (Gantt v2.2 con el corte de avance al 11/10). La Entrega 4 (§4) confirma que el cronograma se gestiona en ProjectLibre con ese XML. El archivo se leyó con Python en modo solo lectura y su SHA-256 se verificó antes y después de cada proceso: está intacto. Esta revisión agregó dos archivos a la carpeta (ahora son cuatro): `proyecto_agrotech_actualizado.xml` (§7) y `PRESUPUESTO_Y_CRONOGRAMA_AGROTECH.md` (copia de este documento).

| Elemento leído | Valor en el XML v2.2 |
|---|---|
| Título | «AgroTech — Cronograma del proyecto (v2.2)» · responsable Julio Carrillo |
| Calendario | «Estándar Colombia»: lunes a viernes de 08:00 a 12:00 y de 13:00 a 17:00 (8 h); festivos 12/10, 02/11, 16/11 y 08/12 |
| Tareas | 45 filas: proyecto, 6 fases (resumen), 32 actividades y 6 hitos (E1 … E6) |
| Precedencias | 52 vínculos fin–comienzo sin desfase |
| Recursos | 3 personas (JC, JD, GV) con capacidad máxima del 100 % |
| Asignaciones | 46, con 1.272 h a jornada de 8 h = 159 días-persona |
| Estimación | Notas PERT (a, m, b, te) y matriz RACI en cada actividad |
| **Costos** | **No cargados:** ninguna tarifa en los recursos (`DefaultStandardRate` = 0) y ningún costo fijo |

Otros hallazgos:

1. **Dedicación.** El calendario es de 8 h por día, pero la Entrega 4 (§3.2) planifica **3 h por día hábil por integrante**: 159 días-persona × 3 h = **477 h**. Sin ajustar las unidades, ProjectLibre calcularía 1.272 h y casi triplicaría el costo del talento humano.
2. **Actividades 5.3 … 5.16.** Tienen el mismo inicio y fin real (09/10) con duraciones de 1 a 9 días. Es un registro intencional: se integraron el fin de semana del 10 y 11 de octubre (Entrega 4, §4). Se conservaron así; su costo se calcula con el esfuerzo planificado.
3. **Avance desactualizado.** La fecha de estado era el 05/10. El hito 5.17 (Entrega 5, 13/11) figuraba al 0 % aunque la Entrega 5 está en `01_Entregas`, y la actividad 5.4 (validación UCD, 13/10) sigue al 0 % sin resultados registrados en `docs/piloto/`.
4. **Pruebas.** Faltaban la revisión de código del 18/11, el plan e informe de QA y la re-ejecución E2E.

Por los puntos 1, 3 y 4 se generó el XML actualizado (sección 7).

## 2. EDT / WBS

```
0  AgroTech
├── 1  Requisitos (Entrega 1)
│   ├── 1.1 Conformar el equipo y definir proyecto y cliente
│   ├── 1.2 Levantamiento de información con el cliente
│   ├── 1.3 Redactar el SRS
│   └── 1.4 ◆ Hito E1 — SRS (11/09)
├── 2  Organización y metodología (Entrega 2)
│   ├── 2.1 Investigar la metodología y preparar el debate
│   ├── 2.2 Configurar Jira, backlog y GitHub
│   ├── 2.3 Requisitos de aceptación y carta de aceptación
│   └── 2.4 ◆ Hito E2 — organización y metodología (15/09)
├── 3  Diseño del sistema (Entrega 3)
│   ├── 3.1 Casos de uso, flujo de información y secuencia
│   ├── 3.2 Diagrama de clases y modelo entidad–relación
│   ├── 3.3 Arquitectura y despliegue
│   ├── 3.4 Documento de diseño del sistema
│   └── 3.5 ◆ Hito E3 — diseño del sistema (02/10)
├── 4  Plan de gestión del proyecto (Entrega 4)
│   ├── 4.1 Plan de gestión: riesgos, métricas, cronograma y calidad
│   └── 4.2 ◆ Hito E4 — plan de gestión (09/10)
├── 5  Construcción del MVP (Entrega 5)
│   ├── 5.1 Entornos, base de datos e integración continua
│   ├── 5.2 Estructura de la app y navegación por rol
│   ├── 5.3 Registro e inicio de sesión (RF-01)
│   ├── 5.4 Validar prototipos de baja fidelidad con la asociación (UCD)
│   ├── 5.5 Plan de pruebas y casos de prueba
│   ├── 5.6 Publicación de productos y catálogo (RF-02, RF-03)
│   ├── 5.7 Preparar el entorno de producción en AWS
│   ├── 5.8 Editar precio y cantidad de una publicación (RF-10a)
│   ├── 5.9 Carrito, pedidos, estados y pago en línea (RF-04, RF-13, RF-21)
│   ├── 5.10 Modo sin conexión y sincronización (RF-17)
│   ├── 5.11 Chat por pedido (RF-05)
│   ├── 5.12 Calificaciones (RF-06)
│   ├── 5.13 Notificación push de nuevo pedido (RF-16a)
│   ├── 5.14 Panel de ventas (RF-07)
│   ├── 5.15 Pedidos activos del consumidor (RF-15a)
│   ├── 5.16 Integración y pruebas unitarias
│   └── 5.17 ◆ Hito E5 — MVP funcional (13/11)
└── 6  Pruebas, despliegue y cierre (Entrega 6)
    ├── 6.1 Pruebas del sistema y de aceptación
    ├── 6.2 Corrección de errores
    ├── 6.3 Publicar la versión final
    ├── 6.4 Piloto con la asociación y prueba de usabilidad
    ├── 6.5 Informe final y carta de aceptación firmada
    ├── 6.6 ◆ Hito E6 — cierre del proyecto (03/12)
    ├── 6.7 Revisión integral de código y corrección ERR-14 a ERR-17   ← nueva (v2.3)
    ├── 6.8 Plan y diseño de pruebas, informe de ejecución y presupuesto   ← nueva (v2.3)
    └── 6.9 Ejecutar E2E (CP-01…CP-30 y banco BP-001…BP-103)   ← nueva (v2.3)
```

La Fase 2 del SRS (v1.1.0, AGRO-22 … AGRO-29) y las correcciones de la 1.1.1 se ejecutaron dentro de la holgura de 23 días hábiles antes de la Entrega 5 que la Entrega 4 (§4.2) dejó para la fase 5. El cronograma v2.2 no las desglosa, así que no se agregaron retroactivamente para no alterar la línea base aprobada.

## 3. Cronograma consolidado (v2.3)

Fechas de ProjectLibre en días hábiles. Horas efectivas a 3 h por día (JC = Julio Carrillo, JD = Julio Durán, GV = Geron Vergara). 🔴 = ruta crítica. «Predecesoras» usa el número de fila (ID) de ProjectLibre. El costo incluye talento humano y costos fijos de la tarea.

| ID | EDT | Actividad | Inicio | Fin | Días | Predecesoras (ID) | Recursos (h) | % | Costo (COP) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **1** | **Requisitos (Entrega 1)** | 01/09 | 11/09 | 9 | | **51 h** | 100 | **$ 2.985.000** |
| 2 | 1.1 | Conformar el equipo y definir proyecto y cliente | 01/09 | 02/09 | 2 | — | JC 6, JD 6, GV 6 | 100 | $ 1.020.000 |
| 3 | 1.2 | Levantamiento de información con el cliente | 03/09 | 08/09 | 4 | 2 | JC 12, JD 12 | 100 | $ 1.380.000 |
| 4 | 1.3 | Redactar el SRS | 09/09 | 11/09 | 3 | 3 | JC 9 | 100 | $ 585.000 |
| 5 | 1.4 | ◆ Hito: Entrega 1 — SRS | 11/09 | 11/09 | 0 | 4 | — | 100 | — |
| 6 | **2** | **Organización y metodología (Entrega 2)** | 03/09 | 15/09 | 9 | | **21 h** | 100 | **$ 1.125.000** |
| 7 | 2.1 | Investigar la metodología y preparar el debate | 03/09 | 07/09 | 3 | 2 | GV 9 | 100 | $ 495.000 |
| 8 | 2.2 | Configurar Jira, backlog y GitHub | 14/09 | 15/09 | 2 | 5 | GV 6 | 100 | $ 330.000 |
| 9 | 2.3 | Requisitos de aceptación y carta de aceptación | 14/09 | 15/09 | 2 | 5 | JD 6 | 100 | $ 300.000 |
| 10 | 2.4 | ◆ Hito: Entrega 2 — organización y metodología | 15/09 | 15/09 | 0 | 7, 8, 9 | — | 100 | — |
| 11 | **3** | **Diseño del sistema (Entrega 3)** | 14/09 | 02/10 | 15 | | **69 h** | 100 | **$ 4.245.000** |
| 12 | 3.1 | Casos de uso, flujo de información y secuencia | 14/09 | 18/09 | 5 | 5 | JC 15 | 100 | $ 975.000 |
| 13 | 3.2 | Diagrama de clases y modelo entidad–relación | 21/09 | 25/09 | 5 | 12 | JC 15, GV 15 | 100 | $ 1.800.000 |
| 14 | 3.3 | Arquitectura y despliegue | 28/09 | 30/09 | 3 | 13 | JC 9, GV 9 | 100 | $ 1.080.000 |
| 15 | 3.4 | Documento de diseño del sistema | 01/10 | 02/10 | 2 | 14 | JC 6 | 100 | $ 390.000 |
| 16 | 3.5 | ◆ Hito: Entrega 3 — diseño del sistema | 02/10 | 02/10 | 0 | 15, 10 | — | 100 | — |
| 17 | **4** | **Plan de gestión del proyecto (Entrega 4)** | 05/10 | 09/10 | 5 | | **15 h** | 100 | **$ 975.000** |
| 18 | 4.1 | Plan de gestión: riesgos, métricas, cronograma y calidad | 05/10 | 09/10 | 5 | 16 | JC 15 | 100 | $ 975.000 |
| 19 | 4.2 | ◆ Hito: Entrega 4 — plan de gestión | 09/10 | 09/10 | 0 | 18 | — | 100 | — |
| 20 | **5** | **Construcción del MVP (Entrega 5)** | 05/10 | 13/11 | 28 | | **240 h** | 98 | **$ 13.665.000** |
| 21 | 5.1 | Entornos, base de datos e integración continua | 05/10 | 08/10 | 4 | 16 | GV 12 | 100 | $ 660.000 |
| 22 | 5.2 | Estructura de la app y navegación por rol | 05/10 | 07/10 | 3 | 16 | JD 9 | 100 | $ 450.000 |
| 23 | 5.3 | Registro e inicio de sesión (RF-01) | 09/10 | 09/10 | 4\* | 21, 22 | GV 12, JD 12 | 100 | $ 1.260.000 |
| 24 | 5.4 | Validar prototipos de baja fidelidad con la asociación (UCD) | 13/10 | 13/10 | 1 | 19 | JC 3 | 0 | $ 345.000 |
| 25 | 5.5 | Plan de pruebas y casos de prueba | 09/10 | 09/10 | 3\* | 24 | JC 9 | 100 | $ 585.000 |
| 26 | 5.6 | Publicación de productos y catálogo (RF-02, RF-03) | 09/10 | 09/10 | 6\* | 23, 24 | JD 18, GV 18 | 100 | $ 1.890.000 |
| 27 | 5.7 | Preparar el entorno de producción en AWS | 09/10 | 09/10 | 2\* | 21, 25 | JC 6 | 100 | $ 510.000 |
| 28 | 5.8 | Editar precio y cantidad de una publicación (RF-10a) | 09/10 | 09/10 | 2\* | 23, 27 | JC 6 | 100 | $ 390.000 |
| 29 | 5.9 | Carrito, pedidos, estados y pago en línea (RF-04, RF-13, RF-21) | 09/10 | 09/10 | 9\* | 26 | GV 27, JD 27 | 100 | $ 2.835.000 |
| 30 | 5.10 | Modo sin conexión y sincronización (RF-17) | 09/10 | 09/10 | 6\* | 26, 28 | JC 18 | 100 | $ 1.170.000 |
| 31 | 5.11 | Chat por pedido (RF-05) | 09/10 | 09/10 | 4\* | 29 | GV 12 | 100 | $ 660.000 |
| 32 | 5.12 | Calificaciones (RF-06) | 09/10 | 09/10 | 2\* | 29 | JD 6 | 100 | $ 300.000 |
| 33 | 5.13 | Notificación push de nuevo pedido (RF-16a) | 09/10 | 09/10 | 2\* | 29, 32 | JD 6 | 100 | $ 300.000 |
| 34 | 5.14 | Panel de ventas (RF-07) | 09/10 | 09/10 | 3\* | 29, 30 | JC 9 | 100 | $ 585.000 |
| 35 | 5.15 | Pedidos activos del consumidor (RF-15a) | 09/10 | 09/10 | 1\* | 34 | JC 3 | 100 | $ 195.000 |
| 36 | 5.16 | Integración y pruebas unitarias | 09/10 | 09/10 | 3\* | 27, 30, 31, 33, 35 | JC 9, JD 9, GV 9 | 100 | $ 1.530.000 |
| 37 | 5.17 | ◆ Hito: Entrega 5 — MVP funcional 🔴 | 13/11 | 13/11 | 0 | 36 | — | 100 | — |
| 38 | **6** | **Pruebas, despliegue y cierre (Entrega 6)** | 17/11 | 03/12 | 13 | | **99 h** | 24 | **$ 7.500.000** |
| 39 | 6.1 | Pruebas del sistema y de aceptación 🔴 | 17/11 | 19/11 | 3 | 37, 25 | JD 9, JC 9 | 67 | $ 1.935.000 |
| 40 | 6.2 | Corrección de errores 🔴 | 20/11 | 24/11 | 3 | 39 | GV 9, JD 9 | 0 | $ 945.000 |
| 41 | 6.3 | Publicar la versión final 🔴 | 25/11 | 25/11 | 1 | 40, 47 | GV 3 | 0 | $ 595.000 |
| 42 | 6.4 | Piloto con la asociación y prueba de usabilidad 🔴 | 26/11 | 01/12 | 4 | 41 | JC 12, JD 12, GV 12 | 0 | $ 2.600.000 |
| 43 | 6.5 | Informe final y carta de aceptación firmada 🔴 | 02/12 | 03/12 | 2 | 42 | JC 6 | 0 | $ 390.000 |
| 44 | 6.6 | ◆ Hito: Entrega 6 — cierre del proyecto 🔴 | 03/12 | 03/12 | 0 | 43 | — | 0 | — |
| 45 | 6.7 | Revisión integral de código y corrección ERR-14 a ERR-17 | 18/11 | 18/11 | 1 | 37 | JC 3 | 100 | $ 195.000 |
| 46 | 6.8 | Plan y diseño de pruebas, informe de ejecución y presupuesto | 18/11 | 19/11 | 2 | 37 | JC 6, JD 6 | 50 | $ 690.000 |
| 47 | 6.9 | Ejecutar E2E (CP-01…CP-30 y banco BP-001…BP-103) con el servidor activo | 20/11 | 20/11 | 1 | 39, 45 | JD 3 | 0 | $ 150.000 |

\* Las actividades 5.3 … 5.16 muestran inicio y fin del 09/10 con su duración planificada (ver §1, hallazgo 2).

### 3.1 Hitos

| Hito | Fecha | Estado al 18/11 |
|---|---|---|
| E1 — SRS | 11/09/2026 | Cumplido |
| E2 — Organización y metodología | 15/09/2026 | Cumplido |
| E3 — Diseño del sistema | 02/10/2026 | Cumplido |
| E4 — Plan de gestión | 09/10/2026 | Cumplido |
| E5 — MVP funcional (fecha acordada, restricción «no antes de») | 13/11/2026 | Cumplido (Entrega 5, v1.1.0) |
| E6 — Cierre del proyecto | 03/12/2026 | Pendiente · 4 días hábiles de margen antes del 10/12 |

### 3.2 Ruta crítica y margen

Se mantiene la de la Entrega 4 (§4.2): **5.17 → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6**, con 4 días hábiles de margen frente al 10/12. PERT del tramo crítico: Te = 13,67 días, σ = 0,94 días, contra 17 días disponibles. Las tareas nuevas 6.7–6.9 terminan el 20/11 y tienen holgura antes de 6.3 (25/11). Se enlazó 6.9 → 6.3 para que la versión final no se publique sin repetir las pruebas E2E.

## 4. Presupuesto detallado (COP)

### 4.1 Supuestos

| Supuesto | Valor | Nota |
|---|---|---|
| Dedicación | 3 h por día hábil por integrante | Entrega 4, §3.2 |
| Esfuerzo | 165 días-persona × 3 h = **495 h** | 477 h de la línea base v2.2 + 18 h de las tareas 6.7–6.9 |
| Tarifas por hora (con carga prestacional) | PM / Arquitecto $65.000 · Backend / DevOps $55.000 · Frontend / QA $50.000 | **Tarifas de referencia propuestas para este presupuesto** (perfiles junior/semi-senior en Colombia, 2026). No vienen de la Entrega 4: deben aprobarse o ajustarse. Se cambian en ProjectLibre (Recursos → Tasa estándar) y el costo se recalcula solo |
| Tasa de cambio | $4.000 por USD | Supuesto para convertir los servicios en dólares; usar la TRM del día del pago |
| Infraestructura AWS | ≈ 55 USD/mes (us-east-1, bajo demanda) durante 1,5 meses | RUNBOOK §8 y Entrega 4 (riesgo 11). Con créditos académicos el costo real puede ser $0 |
| Duración para costos indirectos | 3,3 meses (01/09 – 10/12) | |
| Reserva de contingencia | 10 % del costo directo e indirecto | Respaldo de los riesgos 1, 2 y 14 (Entrega 4, §2) |

### 4.2 Talento humano por rol

| Rol | Integrante | Tarifa (COP/h) | E1 | E2 | E3 | E4 | E5 | E6 | Horas | Costo (COP) |
|---|---|---|---|---|---|---|---|---|---|---|
| Project Manager / Software Architect | Julio Carrillo | $ 65.000 | 27 | 0 | 45 | 15 | 63 | 36 | **186** | **$ 12.090.000** |
| Frontend Developer / QA Tester | Julio Durán | $ 50.000 | 18 | 6 | 0 | 0 | 87 | 39 | **150** | **$ 7.500.000** |
| Backend Developer / DevOps | Geron Vergara | $ 55.000 | 6 | 15 | 24 | 0 | 90 | 24 | **159** | **$ 8.745.000** |
| **Total** | | | **51** | **21** | **69** | **15** | **240** | **99** | **495** | **$ 28.335.000** |

### 4.3 Infraestructura y servicios en la nube

| Concepto | Cálculo | Costo (COP) | Tarea en ProjectLibre |
|---|---|---|---|
| AWS: EC2 t3.small, RDS db.t3.micro, ALB, IPv4, S3, Secrets Manager, CloudWatch, SNS | 55 USD/mes × 1,5 meses × $4.000 | $ 330.000 | 6.3 |
| Cuenta de desarrollador de Google Play (perfil `produccion` de EAS, pista interna) | 25 USD, pago único × $4.000 | $ 100.000 | 6.3 |
| Dominio `agrotech.co` (`api.agrotech.co`) | 1 año | $ 120.000 | 5.7 |
| Firebase Cloud Messaging (push) | Sin costo | $ 0 | — |
| Wompi (pasarela de pagos) | Sandbox sin costo; en producción cobra comisión por transacción al comercio (no es costo del proyecto) | $ 0 | — |
| Expo EAS Build (APK y AAB) | Plan gratuito | $ 0 | — |
| **Subtotal** | | **$ 550.000** | |

### 4.4 Herramientas de software

| Herramienta | Uso | Licencia | Costo (COP) |
|---|---|---|---|
| ProjectLibre 1.9.8 | Cronograma, recursos y costos | Código abierto | $ 0 |
| Jira | Backlog y tablero Kanban (tarjetas AGRO-xx) | Plan gratuito (hasta 10 usuarios) | $ 0 |
| GitHub + GitHub Actions | Repositorio, Pull Requests, CI/CD con OIDC | Plan gratuito / educativo | $ 0 |
| Node.js, Express, PostgreSQL, PostGIS, Docker, Expo, React Native | Desarrollo | Código abierto / uso gratuito | $ 0 |
| Jest, Testing Library, Playwright, ESLint | Pruebas y calidad | Código abierto | $ 0 |
| draw.io, VS Code | Diagramas y edición | Gratuitas | $ 0 |
| **Subtotal** | | | **$ 0** |

Los planes gratuitos tienen límites de uso (minutos de CI, compilaciones de EAS) que hay que revisar si el proyecto continúa después del piloto.

### 4.5 Equipos de prueba y logística

| Concepto | Cálculo | Costo (COP) | Tarea |
|---|---|---|---|
| Teléfonos Android de gama baja para pruebas (BP-103, CP-15) | 2 × $450.000 | $ 900.000 | 6.1 |
| Validación UCD: impresión de 5 wireframes a tamaño real y transporte | | $ 150.000 | 5.4 |
| Piloto: transporte a veredas (2 salidas × 3 personas), refrigerios de 10 participantes, impresión de consentimientos, guion y SUS | $360.000 + $150.000 + $50.000 | $ 560.000 | 6.4 |
| **Subtotal** | | **$ 1.610.000** | |

### 4.6 Costos indirectos (fuera de ProjectLibre)

| Concepto | Cálculo | Costo (COP) |
|---|---|---|
| Depreciación de 3 computadores portátiles | 3 × $3.000.000 ÷ 36 meses × 3,3 meses | $ 825.000 |
| Conectividad a internet | 3 × $90.000/mes × 3,3 meses | $ 891.000 |
| **Subtotal** | | **$ 1.716.000** |

### 4.7 Costo total consolidado

| Rubro | Costo (COP) | % |
|---|---|---|
| Talento humano (495 h) | $ 28.335.000 | 80,0 % |
| Infraestructura y servicios en la nube | $ 550.000 | 1,6 % |
| Herramientas de software | $ 0 | 0,0 % |
| Equipos de prueba y logística (UCD y piloto) | $ 1.610.000 | 4,5 % |
| **Costo directo (cargado en ProjectLibre)** | **$ 30.495.000** | 86,1 % |
| Costos indirectos | $ 1.716.000 | 4,8 % |
| **Subtotal** | **$ 32.211.000** | 90,9 % |
| Reserva de contingencia (10 %) | $ 3.221.100 | 9,1 % |
| **COSTO TOTAL DEL PROYECTO** | **$ 35.432.100** | 100 % |

**Conciliación con ProjectLibre.** Al abrir `proyecto_agrotech_actualizado.xml`, el costo de la tarea resumen «AgroTech» debe ser **$ 30.495.000**: $ 28.335.000 de trabajo (horas × tarifa) más $ 2.160.000 de costos fijos en las tareas 5.4, 5.7, 6.1, 6.3 y 6.4. Los indirectos y la contingencia se gestionan fuera del cronograma.

### 4.8 Costo por fase

| Fase | Nombre | Fechas | Horas | Talento humano | Costos fijos | Costo directo |
|---|---|---|---|---|---|---|
| 1 | Requisitos (Entrega 1) | 01/09–11/09 | 51 | $ 2.985.000 | $ 0 | $ 2.985.000 |
| 2 | Organización y metodología (Entrega 2) | 03/09–15/09 | 21 | $ 1.125.000 | $ 0 | $ 1.125.000 |
| 3 | Diseño del sistema (Entrega 3) | 14/09–02/10 | 69 | $ 4.245.000 | $ 0 | $ 4.245.000 |
| 4 | Plan de gestión del proyecto (Entrega 4) | 05/10–09/10 | 15 | $ 975.000 | $ 0 | $ 975.000 |
| 5 | Construcción del MVP (Entrega 5) | 05/10–13/11 | 240 | $ 13.395.000 | $ 270.000 | $ 13.665.000 |
| 6 | Pruebas, despliegue y cierre (Entrega 6) | 17/11–03/12 | 99 | $ 5.610.000 | $ 1.890.000 | $ 7.500.000 |
| **Total** | | **01/09–03/12** | **495** | **$ 28.335.000** | **$ 2.160.000** | **$ 30.495.000** |

## 5. Costos de la calidad

Clasificación de la Entrega 4 (§5.3) aplicada a las actividades del cronograma:

| Categoría | Actividades | Horas | Costo (COP) | % del costo directo |
|---|---|---|---|---|
| Prevención | 2.3 Requisitos de aceptación · 4.1 Plan de gestión y SQA · 5.4 Validación UCD · 5.5 Plan de pruebas | 33 | $ 2.205.000 | 7,2 % |
| Evaluación | 5.16 Integración y pruebas unitarias · 6.1 Pruebas del sistema y de aceptación · 6.4 Piloto y usabilidad · 6.8 Plan e informe de QA · 6.9 Ejecución E2E | 96 | $ 6.905.000 | 22,6 % |
| Fallos internos | 6.2 Corrección de errores · 6.7 Revisión y corrección ERR-14 a ERR-17 | 21 | $ 1.140.000 | 3,7 % |
| Fallos externos | Atención de defectos durante el piloto (sin registros al 18/11) | 0 | $ 0 | 0,0 % |
| **Costo total de la calidad** | | **150** | **$ 10.250.000** | **33,6 %** |

Los costos de evaluación incluyen el costo fijo de los teléfonos de prueba (6.1) y la logística del piloto (6.4); los de prevención, la impresión de la validación UCD (5.4). La revisión de pares de los Pull Requests está incluida en las horas de cada actividad de construcción.

## 6. Seguimiento al 18/11/2026 (valor ganado)

| Indicador | Valor | Lectura |
|---|---|---|
| Presupuesto a la conclusión (BAC, costo directo) | $ 30.495.000 | |
| Valor planificado (PV) al 18/11 | $ 24.825.000 | 81,4 % del BAC |
| Valor ganado (EV) al 18/11 | $ 24.486.450 | 80,3 % del BAC |
| Variación del cronograma (SV = EV − PV) | −$ 338.550 | Atraso equivalente a la actividad 5.4 (validación UCD, −$ 345.000), programada el 13/10 y sin ejecutar. Los +$ 6.450 restantes vienen del redondeo de la 6.1: el PV usa 2/3 exactos ($ 1.290.000) y el EV el 67 % del XML ($ 1.296.450); (0,67 − 2/3) × $ 1.935.000 = $ 6.450 |
| Índice de desempeño del cronograma (SPI = EV / PV) | **0,986** | Prácticamente en plan |
| Costo real (AC), CV y CPI | No disponibles | Las horas reales en Jira no están en este repositorio. Al registrarlas en ProjectLibre (trabajo real por asignación) se obtienen CV = EV − AC y CPI = EV / AC |

El PV se calcula con la fracción de días hábiles programados transcurridos al cierre del 18/11. El EV usa el % completado del XML v2.3. Los dos prorratean el costo fijo de cada tarea con el mismo porcentaje que el trabajo. ProjectLibre, en cambio, causa los costos fijos al final de la tarea (`FixedCostAccrual` = 3), así que en sus indicadores de valor ganado la 6.1 no sumará esos $ 900.000 hasta terminar. 6.1 al 67 % es una estimación: pasaron 2 de sus 3 días y las pruebas de sistema ya se ejecutaron, falta la aceptación del piloto.

## 7. Archivo para ProjectLibre: `proyecto_agrotech_actualizado.xml`

### 7.1 Cambios frente al v2.2

| Cambio | Detalle |
|---|---|
| Moneda y estado | Código de moneda COP (símbolo `$`, 0 decimales, igual que el original); fecha de estado 18/11/2026; título «v2.3» |
| Tarifas | Tasa estándar por hora en los 3 recursos (JC $65.000, JD $50.000, GV $55.000) |
| Dedicación | Las 50 asignaciones quedan al 37,5 % (3 de 8 h) con su trabajo recalculado (p. ej. 32 h → 12 h). Las tareas son de duración fija (tipo 1), así que **ninguna fecha ni duración cambia**: se comprobó tarea por tarea contra el v2.2 |
| Costos fijos | 5.4 $150.000 · 5.7 $120.000 · 6.1 $900.000 · 6.3 $430.000 · 6.4 $560.000 (se causan al final de la tarea) |
| Avance | Hito 5.17 al 100 % (13/11); 6.1 al 67 % (inicio real 17/11); resúmenes recalculados por duración (proyecto 87 %, fase 5 98 %, fase 6 24 %) |
| Tareas nuevas | 6.7 (18/11, JC, 100 %), 6.8 (18–19/11, JC + JD, 50 %), 6.9 (20/11, JD, 0 %; predecesoras 6.1 y 6.7) y vínculo 6.9 → 6.3 |
| Sin cambios | Calendario y festivos, 52 precedencias originales, notas PERT/RACI, restricción del hito E5, datos reales de las fases 1–5 |

### 7.2 Verificación

El archivo se leyó con el lector de MS Project XML (`net.sf.mpxj.mspdi.MSPDIReader`) incluido en `C:\Program Files\ProjectLibre\app\projectlibre-1.9.8.jar`, el mismo que usa ProjectLibre al abrirlo. Resultado: 48 tareas y 50 asignaciones con 495 h, tarifas de 65.000 / 50.000 / 55.000 por hora, moneda COP, costos fijos con su valor correcto y fechas iguales a las del v2.2.

> Nota técnica: MSPDI guarda los importes de las tareas en centésimas de la moneda. La primera versión del archivo tenía los costos fijos 100 veces menores; la verificación con MPXJ lo detectó y se corrigió antes de entregarlo.

### 7.3 Cómo abrirlo

1. ProjectLibre → **Archivo → Abrir** → `proyecto_agrotech_actualizado.xml` (tipo «Microsoft Project XML»).
2. Revisar los costos: vista **Recursos** (columna «Tasa estándar») y **Gantt** → Insertar columnas «Costo» y «Costo fijo».
3. Guardarlo como `.pod` (formato nativo) si se va a seguir editando en ProjectLibre. El XML v2.2 original queda como línea base histórica.
4. Para registrar el avance real, actualizar el % completado o el trabajo real por asignación con la fecha de estado de cada corte.
