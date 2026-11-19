# Informe de Auditoría Externa de Calidad de Software (QA) e Ingeniería de Proyectos · AgroTech 1.1.1

| Campo | Detalle |
|---|---|
| **Fecha de auditoría** | 18 de noviembre de 2026 |
| **Auditor** | Auditoría Externa Independiente de QA e Ingeniería de Proyectos (Gemini) |
| **Versión auditada** | AgroTech `1.1.1` · Rama `main` · Commits `2f1eb0d`, `2d85ae6` y `99b818f` |
| **Normas de referencia** | IEEE 829 / ISO/IEC/IEEE 29119-3 (Documentación de pruebas), IEEE 1044 (Clasificación de anomalías), PMBOK / EVM (Gestión de valor ganado y costos), Esquema MSPDI (Microsoft Project XML / ProjectLibre 1.9.8) |
| **Alcance de inspección** | Código fuente (`api/`, `app/`, `db/`, `e2e/`), `RESUMEN_REVISION_CODIGO.md`, `docs/pruebas/PLAN_Y_DISENO_PRUEBAS.md`, `docs/pruebas/INFORME_EJECUCION_PRUEBAS.md`, `docs/pruebas/REGISTRO_DE_ERRORES.md`, `docs/GESTION_PROJECTLIBRE_COSTOS.md`, `01_Documentacion/03_Gestion/PRESUPUESTO_Y_CRONOGRAMA_AGROTECH.md`, `AgroTech_Cronograma.xml` (v2.2) y `proyecto_agrotech_actualizado.xml` (v2.3) |
| **Veredicto general** | **APROBADO CON CONDICIONES PRE-LIBERACIÓN (0 Críticos · 1 Mayor · 5 Menores)** |

---

## 1. Dictamen General

Tras realizar una inspección técnica, documental y matemática independiente sobre el repositorio de código (`02_Codigo/agrotech`) y los artefactos de gestión (`01_Documentacion/03_Gestion`), se dictamina que el proyecto **AgroTech v1.1.1** presenta un **nivel de madurez técnica sobresaliente**, con trazabilidad completa entre requisitos (RF-01 a RF-21 y RNF-01 a RNF-10), casos de prueba, bitácora de defectos y presupuesto en ProjectLibre 1.9.8.

- **Calidad técnica y pruebas unitarias/integración:** El 100 % de las suites automatizadas en Jest pasan sin errores (**API: 244/244 pruebas en 29 suites**, cobertura de líneas del **95,51 %**; **App: 98/98 pruebas en 9 suites**, cobertura de líneas del **83,26 %**; análisis estático `eslint` y `expo lint` con **0 errores**).
- **Seguridad e higiene del repositorio:** No existen credenciales expuestas ni archivos `.env` o llaves privadas rastreados en Git. Las correcciones **ERR-14 a ERR-17** son limpias, mínimas y bien acotadas.
- **Exactitud presupuestal y ProjectLibre v2.3:** La conciliación matemática entre el documento de costos y el archivo `proyecto_agrotech_actualizado.xml` es **100 % exacta** en horas (**495 h = 477 h + 18 h**), tarifas (**$65.000, $55.000 y $50.000 COP/h**), costos fijos en centésimas MSPDI (**216.000.000 centésimas = $2.160.000 COP**), costo directo (**$30.495.000 COP**), costos indirectos (**$1.716.000 COP**), reserva de contingencia del 10 % (**$3.221.100 COP**) y costo total (**$35.432.100 COP**).
- **Condición para liberación final (EDT 6.3, 25/11/2026):** Se ratifica el estado **APTO CON CONDICIONES** reportado en el Informe de Ejecución. Como el commit `2d85ae6` modificó `PantallaPerfil.js` y `ventas.service.js` el 18/11/2026 —fecha posterior a la última corrida de Playwright del 16/11/2026—, es obligatorio ejecutar la actividad programada **EDT 6.9 (20/11/2026)** para revalidar las suites E2E (`CP-01…CP-30` y `BP-001…BP-100`) y verificar manualmente `CP-32` en un dispositivo físico con Expo Go antes de publicar la versión final.

---

## 2. Auditoría del Punto 1: Integridad del Código, Seguridad y Compatibilidad con Expo Go SDK 58

### 2.1 Verificación del historial de cambios (`git log -n 3` y `git show --stat`)

| Commit | Fecha | Autor | Resumen de cambios auditados | Estado |
|---|---|---|---|---|
| `99b818f` | 2026-11-18 20:38 -0500 | Julio Carrillo | `docs: plan de pruebas, informe de ejecucion y presupuesto ProjectLibre v2.3` (8 archivos nuevos, +822 líneas, incluyendo `docs/pruebas/evidencias/`) | ✅ Íntegro |
| `2d85ae6` | 2026-11-18 20:16 -0500 | Julio Carrillo | `refactor: revisión integral, corrección ERR-14 a ERR-17 y puesta a punto pre-entrega` (12 archivos modificados, +175 / −29 líneas) | ✅ Íntegro |
| `2f1eb0d` | 2026-11-18 17:59 -0500 | Julio Carrillo | `chore: punto de control antes de iniciar flujo multi-agente` (línea base de Fase 2 + banco de pruebas) | ✅ Íntegro |

### 2.2 Revisión técnica de las correcciones ERR-14 a ERR-17 y limpieza de código

1. **ERR-14 (`api/tests/integration/auth.test.js`, líneas 186–192) — Tolerancia de reloj en bloqueo de cuenta (CP-02):**
   - **Análisis:** PostgreSQL calcula `bloqueado_hasta = now() + interval '15 minutes'` y la prueba lo compara contra `Date.now()` del proceso Node en Windows. Un desfase de milisegundos entre el reloj del contenedor Docker y el host producía `15.00005 > 15`.
   - **Veredicto:** La cota `expect(minutos).toBeLessThanOrEqual(15 + 5 / 60)` (tolerancia de 5 s, alineada con `15.1` min en `e2e/api/cuentas.spec.js`) mantiene intacta la regla de negocio (`expect(minutos).toBeGreaterThan(14)` y HTTP 423 `CUENTA_BLOQUEADA`).
2. **ERR-15 (`app/package.json`, línea 47) — Timeout de Jest sobre OneDrive:**
   - **Análisis:** Se añadió `"testTimeout": 30000` en la sección `"jest"` de `app/package.json`.
   - **Veredicto:** Solución limpia que evita que la compilación en frío de Babel sobre el sistema de archivos sincronizado con OneDrive aborte el primer test de `sincronizacion.test.js` a los 5 s y deje `expo-router` a medio montar.
3. **ERR-16 (`api/src/modules/ventas/ventas.service.js`, líneas 44–46; `api/tests/integration/ventas.test.js`, líneas 203–206) — Validación contra `Object.prototype`:**
   - **Análisis:** Se reemplazó `if (!PERIODOS[codigo])` por `if (typeof codigo !== 'string' || !Object.hasOwn(PERIODOS, codigo))`. Esto bloquea tanto claves heredadas del prototipo (`?periodo=constructor`, `?periodo=toString`, `?periodo=__proto__`) como arreglos por parámetros duplicados (`?periodo=mes&periodo=anio`).
   - **Barrido transversal en toda la API:** Como parte de esta auditoría se inspeccionaron todos los accesos indexados a diccionarios en `api/src/`:
     - `ACCIONES_ESTADO[accion]` (`productos.validacion.js:116`), `MOTIVOS[motivo]` (`reportes.service.js:25`), `FRANJAS[...]` (`pedidos.validacion.js:47`), `manejadores[op.tipo]` (`sync.service.js:104`) y `filtros[estado]` (`admin.service.js:154`): **Seguros**, porque transforman la entrada con `.toUpperCase()` antes de indexar (ninguna propiedad de `Object.prototype` está en mayúsculas).
     - `GRUPOS` (`pedidos.validacion.js:97`): **Seguro**, usa `Object.prototype.hasOwnProperty.call(GRUPOS, bruto.toLowerCase())`.
     - `ORDENES` (`productos.repository.js:158`): **Seguro**, validado previamente con `ORDENES_CATALOGO.includes(f.orden)`.
     - `PORCLAVE` (`datos/municipios.js:24`): **Seguro**, utiliza `Map.prototype.get()`.
   - **Veredicto:** `ventas.service.js` era efectivamente el único punto vulnerable a propiedades heredadas de `Object.prototype` en la API y quedó correctamente cerrado.
4. **ERR-17 (`app/src/api/cliente.js:174–178`, `app/src/componentes/PantallaPerfil.js:70–87, 126–132`, `app/__tests__/fase2.test.js:117–133`) — Cambio de foto de perfil (CU-09 paso 2):**
   - **Análisis:** Se implementó `api.cambiarFotoPerfil(uri)` enviando `FormData` (`PUT /api/v1/perfil/foto` con timeout de 60 s para redes 3G rurales) y se integró en `PantallaPerfil.js` reutilizando `obtenerFoto('galeria')` (`expo-image-picker` + `expo-image-manipulator` a 1024 px y calidad JPEG 0,6). El botón se deshabilita cuando `enviando || !enLinea`.
   - **Veredicto:** Implementación limpia y funcional. Se identificaron dos oportunidades de mejora menor (ver **HALL-02** y **HALL-03** en la Sección 5): sincronizar `fotoUrl` en `SesionContext` tras actualizar la foto y homologar el código de estado por tamaño excesivo entre el servicio y Multer.
5. **Limpieza de código muerto y estructura:**
   - `app/src/componentes/EnConstruccion.js` fue eliminado; un barrido sobre todos los archivos `.js` del repositorio confirmó **0 referencias residuales**.
   - En `api/src/server.js` los `require('node:os')` y `require('./db/migrate')` fueron agrupados en el encabezado del archivo. La ejecución de `npm --prefix api run lint` durante esta auditoría finalizó con **0 errores**.

### 2.3 Auditoría de variables de entorno y ausencia de credenciales

- Se extrajeron programáticamente las **31 variables `process.env.*`** leídas en `api/` (`src/config/env.js`, `src/server.js`, `scripts/crear-admin.js`). Las **31/31** están documentadas en `api/.env.example`, incluyendo `AUTO_MIGRAR`, `WOMPI_URL_CHECKOUT` y las instrucciones seguras de `ADMIN_CONTRASENA`.
- Ningún archivo `.env`, llave privada JWT, secreto de Wompi ni credencial JSON de Firebase está versionado en Git (`git ls-files` solo contiene `api/.env.example` y `app/.env.example`, ambos con valores vacíos o de desarrollo local sin secretos reales).
- `.gitignore` protege explícitamente `.env`, `.env.*`, `*firebase-adminsdk*.json`, `fcm-credenciales*.json`, `app/google-services.json`, `api/uploads/` y `api/tmp/`.
- En `app/`, `app/app.config.js` lee `process.env.GOOGLE_SERVICES_JSON` para compilaciones en EAS Build; se sugiere documentarla como comentario opcional en `app/.env.example` (ver **HALL-06**).

### 2.4 Compatibilidad con Expo Go SDK 58

- Todas las dependencias en `app/package.json` están alineadas con **Expo SDK 58** (`expo ^58.0.0`, `react 19.3.0`, `react-native 0.88.1`, `expo-router ~58.0.31`, `expo-sqlite ~58.0.17`, `expo-image-picker ~58.0.10`, `expo-image-manipulator ~58.0.16`, `expo-location ~58.0.22`, `expo-notifications ~58.1.9`, `expo-secure-store ~58.0.3`, `jest-expo ~58.0.14`).
- `app/app.json` mantiene `["expo-router", { "asyncRoutes": false }]` (previniendo el fallo ERR-03 de pantalla en blanco sin conexión).
- El manejo de notificaciones en `app/src/notificaciones/push.js` captura la restricción de Expo Go en Android (que no entrega push remoto FCM) y degrada limpiamente a WebSocket (`/ws`) y bandeja interna.

---

## 3. Auditoría del Punto 2: Trazabilidad de Pruebas

### 3.1 Verificación de correspondencia Plan de Pruebas ↔ Código ↔ Informe de Ejecución

Se auditaron los **32 casos de prueba de sistema (`CP-01` a `CP-32`)**, los **103 casos del banco de pruebas (`BP-001` a `BP-103`)** y las **38 suites de Jest (`29` en API + `9` en App)**:

| Conjunto de pruebas | Casos diseñados | Archivo / ubicación en código verificada | Resultado en `INFORME_EJECUCION_PRUEBAS.md` | Evidencia verificada | Estado de auditoría |
|---|---|---|---|---|---|
| **API · Jest (Unitarias + Integración)** | 244 pruebas (29 suites: 18 int. + 11 unit.) | `api/tests/integration/*.test.js`, `api/tests/integration/fase2/*.test.js`, `api/tests/unit/*.test.js` | **244/244 PASS** (313,9 s) · Cobertura líneas: **95,51 %** (2172/2274) | `docs/pruebas/evidencias/2026-11-18_api_jest.txt` y `2026-11-18_cobertura.txt` | ✅ Exacto |
| **App · Jest + Testing Library** | 98 pruebas (9 suites) | `app/__tests__/*.test.js` (`sincronizacion`, `fase2`, `comunicacion`, `pedidos`, `navegacion`, `productos`, `cuenta`, `cliente`, `servidor`) | **98/98 PASS** (62,9 s) · Cobertura líneas: **83,26 %** (1905/2288) | `docs/pruebas/evidencias/2026-11-18_app_jest.txt` y `2026-11-18_cobertura.txt` | ✅ Exacto |
| **Sistema E2E (`CP-01` a `CP-30`)** | 30 casos (28 auto / 51 pruebas + 2 manuales: `CP-12`, `CP-15`) | `e2e/casos.js`, `e2e/api/*.spec.js` (7 archivos), `e2e/ui/*.spec.js` (3 archivos) | **28 PASA · 0 FALLA · 2 MANUAL** (51/51 pruebas en 60,9 s, corrida del 16/11) | `docs/pruebas/INFORME_PRUEBAS_SISTEMA.md` | ⚠️ Pendiente re-ejecutar sobre `2d85ae6` (EDT 6.9) |
| **Nuevos casos (`CP-31` y `CP-32`)** | 2 casos (ERR-16 ventas y ERR-17 foto perfil) | `api/tests/integration/ventas.test.js:199–207`, `app/__tests__/fase2.test.js:117–133`, `api/tests/integration/fase2/perfil_privacidad.test.js:76–83` | **2/2 PASA en Jest** · Pendiente incluir en `e2e/casos.js` y probar `CP-32` en Expo Go | `2026-11-18_api_jest.txt` y `2026-11-18_app_jest.txt` | ⚠️ Sin prueba `@CP-31`/`@CP-32` en Playwright ni test `>300 KB` en `perfil_privacidad.test.js` |
| **Banco de pruebas (`BP-001` a `BP-103`)** | 103 casos (100 auto + 3 manuales piloto: `BP-101…103`) | `e2e/banco/banco.js`, `e2e/banco/*.spec.js` (5 archivos) | **100/100 PASA** (3 repeticiones = 300/300, 555 llamadas HTTP, corrida del 16/11) | `docs/pruebas/BANCO_PRUEBAS.md` | ⚠️ Pendiente re-ejecutar sobre `2d85ae6` (EDT 6.9) |

### 3.2 Observaciones específicas de trazabilidad

1. **Verificación de `CP-31` (ERR-16 en ventas) y `CP-32` (ERR-17 en perfil):**
   - `CP-31` está correctamente implementado en `api/tests/integration/ventas.test.js` probando `?periodo=constructor`, `?periodo=toString`, `?periodo=mes&periodo=anio` y `?periodo=siglo` con respuesta HTTP 400.
   - `CP-32` está implementado en `app/__tests__/fase2.test.js` (flujo completo en UI: selección de foto, envío a `PUT /perfil/foto`, renderizado de `foto-perfil` con la nueva URI, mensaje `✓ Foto de perfil actualizada` y deshabilitación del botón al desconectar la red con `global.__red.desconectar()`) y en `api/tests/integration/fase2/perfil_privacidad.test.js` (subida de JPEG válido → 200 y archivo no JPEG → 400). Como el propio Plan de Pruebas reconoce en su línea 146, el caso borde de archivo `> 300 KB → 413 FOTO_MUY_GRANDE` no está automatizado en `perfil_privacidad.test.js` (ver **HALL-02**).
2. **Desajuste puntual en `docs/pruebas/REGISTRO_DE_ERRORES.md` (§5, línea 131):**
   - Aunque `REGISTRO_DE_ERRORES.md` registra en §4b (línea 122) el resultado `98/98` tras agregar la prueba de `CP-32` (ERR-17), la tabla resumen de la **Sección 5 («Verificación de la versión 1.1.1», línea 131)** conservó el valor anterior `97/97` para `App (Jest + Testing Library, SDK 58)` (ver **HALL-04**).
3. **Precisión en el conteo de módulos de la API (`16` vs `17`):**
   - Tanto `RESUMEN_REVISION_CODIGO.md` (§1, línea 15) como `PLAN_Y_DISENO_PRUEBAS.md` (§1.1, línea 20) mencionan «17 módulos». En realidad, `api/src/modules/` contiene **16 subdirectorios** (`admin`, `auth`, `calificaciones`, `correo`, `dispositivos`, `mensajes`, `notificaciones`, `pagos`, `pedidos`, `perfil`, `privacidad`, `productos`, `reportes`, `salud`, `sync`, `ventas`), la lista enumerada en `PLAN_Y_DISENO_PRUEBAS.md` contiene **16 ítems** (desglosa `productos` y `catálogo`, y omite `correo`), mientras que `api/src/routes.js` realiza **17 montajes `router.use(...)`** bajo `/api/v1` (porque `mensajes` y `calificaciones` se montan tanto anidados en `/pedidos/:id/...` como en la raíz). Ver **HALL-05**.

---

## 4. Auditoría del Punto 3: Coherencia con ProjectLibre y Cálculos Matemáticos de Costos

Se realizó una auditoría matemática independiente procesando directamente los árboles XML de `01_Documentacion/03_Gestion/AgroTech_Cronograma.xml` (v2.2, 57.700 bytes) y `01_Documentacion/03_Gestion/proyecto_agrotech_actualizado.xml` (v2.3, 63.685 bytes) y contrastándolos contra `docs/GESTION_PROJECTLIBRE_COSTOS.md` y `01_Documentacion/03_Gestion/PRESUPUESTO_Y_CRONOGRAMA_AGROTECH.md`.

### 4.1 Auditoría de horas y dedicación (477 h + 18 h = 495 h)

- **Línea base v2.2 (`AgroTech_Cronograma.xml`):**
  - Contiene **45 tareas** (1 resumen de proyecto `UID=0`, 6 resúmenes de fase `UID=101..106`, 32 actividades hoja y 6 hitos `E1..E6`), **52 vínculos de precedencia** y **46 asignaciones** con `<Units>1</Units>` (jornada del calendario «Estándar Colombia» de 8 h/día = 480 min/día).
  - La suma exacta de `<Work>` en las 46 asignaciones del XML v2.2 es **1.272 horas**, equivalentes a:
    $$\frac{1.272\text{ h}}{8\text{ h/día}} = \mathbf{159\text{ días-persona}}$$
  - Al aplicar la dedicación real establecida en la Entrega 4 (§3.2) de **3 h/día hábil por integrante** ($\text{Units} = \frac{3}{8} = \mathbf{0,375}$):
    $$159\text{ días-persona} \times 3\text{ h/día} = \mathbf{477\text{ horas (línea base)}}$$
- **Actividades incorporadas en v2.3 (`proyecto_agrotech_actualizado.xml`):**
  - Se añadieron **3 actividades** al cierre de la Fase 6 (`EDT 6.7`, `6.8` y `6.9`, pasando de 45 a **48 tareas** y de 46 a **50 asignaciones**, todas con `<Units>0.375</Units>`):
    - `EDT 6.7` (ID 45, UID 39, 1 día, 18/11): Julio Carrillo = **3 h** (100 % completado).
    - `EDT 6.8` (ID 46, UID 40, 2 días, 18–19/11): Julio Carrillo = **6 h** + Julio Durán = **6 h** = **12 h** (50 % completado).
    - `EDT 6.9` (ID 47, UID 41, 1 día, 20/11): Julio Durán = **3 h** (0 % completado).
    - Subtotal nuevas actividades = $3 + 12 + 3 = \mathbf{18\text{ horas}}$ (6 días-persona).
- **Total de esfuerzo auditado en el XML v2.3:**
  $$477\text{ h} + 18\text{ h} = \mathbf{495\text{ horas}} \quad (165\text{ días-persona})$$
- **Invarianza de fechas del cronograma:** Se verificó programáticamente que las 45 tareas originales conservan en el XML v2.3 exactamente las mismas etiquetas `<Start>`, `<Finish>` y `<Duration>` que en el XML v2.2 (dado que son tareas de duración fija `<Type>1</Type>` y `<EffortDriven>0</EffortDriven>`).

### 4.2 Auditoría de tarifas y costo del talento humano ($28.335.000 COP)

En `proyecto_agrotech_actualizado.xml`, los 3 recursos tienen `<StandardRateFormat>2</StandardRateFormat>` (tasa por hora):

| UID | Recurso | Rol | Tarifa XML (`StandardRate`) | E1 (h) | E2 (h) | E3 (h) | E4 (h) | E5 (h) | E6 (h) | Total Horas | Cálculo Matemático | Costo Auditado (COP) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `1` | Julio Carrillo | PM / Software Architect | `$ 65.000/h` | 27 | 0 | 45 | 15 | 63 | 36 | **186 h** | $186 \times \$65.000$ | **$ 12.090.000** |
| `2` | Julio Durán | Frontend Developer / QA Tester | `$ 50.000/h` | 18 | 6 | 0 | 0 | 87 | 39 | **150 h** | $150 \times \$50.000$ | **$ 7.500.000** |
| `3` | Geron Vergara | Backend Developer / DevOps | `$ 55.000/h` | 6 | 15 | 24 | 0 | 90 | 24 | **159 h** | $159 \times \$55.000$ | **$ 8.745.000** |
| — | **TOTAL** | — | — | **51** | **21** | **69** | **15** | **240** | **99** | **495 h** | $\sum \text{Costos de trabajo}$ | **$ 28.335.000** |

**Resultado:** Coincidencia del **100 %** entre las 50 asignaciones del XML v2.3 y la tabla §4.2 del documento de costos.

### 4.3 Auditoría de costos fijos en centésimas dentro del XML de ProjectLibre 1.9.8 ($2.160.000 COP)

El lector MSPDI de ProjectLibre 1.9.8 (`net.sf.mpxj.mspdi.MSPDIReader`) interpreta la etiqueta `<FixedCost>` de las tareas en **centésimas de la unidad monetaria** ($\text{valor en COP} \times 100$). Se auditaron todas las etiquetas `<FixedCost>` presentes en `proyecto_agrotech_actualizado.xml`:

| ID | UID | EDT | Actividad | Concepto del costo fijo | Valor en XML (`<FixedCost>`) | Conversión MPXJ ($\div 100$) | `<FixedCostAccrual>` |
|---|---|---|---|---|---|---|---|
| 24 | 19 | **5.4** | Validar prototipos de baja fidelidad (UCD) | Impresión de 5 wireframes a tamaño real y transporte | `15000000` | **$ 150.000 COP** | `3` (Fin) |
| 27 | 22 | **5.7** | Preparar el entorno de producción en AWS | Dominio `agrotech.co` (1 año) | `12000000` | **$ 120.000 COP** | `3` (Fin) |
| 39 | 33 | **6.1** | Pruebas del sistema y de aceptación | 2 teléfonos Android de gama baja ($2 \times \$450.000$) | `90000000` | **$ 900.000 COP** | `3` (Fin) |
| 41 | 35 | **6.3** | Publicar la versión final | AWS ($55\text{ USD} \times 1,5\text{ m} \times \$4.000 = \$330.000$) + Google Play ($25\text{ USD} \times \$4.000 = \$100.000$) | `43000000` | **$ 430.000 COP** | `3` (Fin) |
| 42 | 36 | **6.4** | Piloto con la asociación y prueba de usabilidad | Transporte veredas ($\$360.000$) + refrigerios 10 part. ($\$150.000$) + papelería SUS ($\$50.000$) | `56000000` | **$ 560.000 COP** | `3` (Fin) |
| — | — | — | **TOTAL COSTOS FIJOS** | Infraestructura nube ($\$550.000$) + Equipos y logística ($\$1.610.000$) | **`216000000`** | **$ 2.160.000 COP** | — |

**Resultado:** Coincidencia del **100 %**.

### 4.4 Auditoría del costo directo, indirectos, contingencia (10 %), fases, CoQ y Valor Ganado (EVM)

1. **Consolidado general del presupuesto:**
   - **Costo directo en ProjectLibre:** $\$28.335.000\text{ (trabajo)} + \$2.160.000\text{ (costos fijos)} = \mathbf{\$30.495.000\text{ COP}}$ ($86,066\% \approx 86,1\%$).
   - **Costos indirectos (3,3 meses, fuera de ProjectLibre):**
     - Depreciación de 3 portátiles: $3 \times \frac{\$3.000.000}{36\text{ meses}} \times 3,3\text{ meses} = \$250.000/\text{mes} \times 3,3 = \mathbf{\$825.000\text{ COP}}$.
     - Conectividad a internet: $3 \times \$90.000/\text{mes} \times 3,3\text{ meses} = \$270.000/\text{mes} \times 3,3 = \mathbf{\$891.000\text{ COP}}$.
     - Subtotal indirectos = $\$825.000 + \$891.000 = \mathbf{\$1.716.000\text{ COP}}$ ($4,843\% \approx 4,8\%$).
   - **Subtotal (Directo + Indirecto):** $\$30.495.000 + \$1.716.000 = \mathbf{\$32.211.000\text{ COP}}$ ($90,909\% \approx 90,9\%$).
   - **Reserva de contingencia (10 %):** $0,10 \times \$32.211.000 = \mathbf{\$3.221.100\text{ COP}}$ ($9,091\% \approx 9,1\%$).
   - **COSTO TOTAL DEL PROYECTO:** $\$32.211.000 + \$3.221.100 = \mathbf{\$35.432.100\text{ COP}}$ ($100,0\%$). **100 % exacto.**
2. **Conciliación por fases (E1 a E6):**
   - Fase 1 (51 h): $\$2.985.000$ · Fase 2 (21 h): $\$1.125.000$ · Fase 3 (69 h): $\$4.245.000$ · Fase 4 (15 h): $\$975.000$ · Fase 5 (240 h): $\$13.395.000 + \$270.000 = \$13.665.000$ · Fase 6 (99 h): $\$5.610.000 + \$1.890.000 = \$7.500.000$.
   - Suma de fases = $\mathbf{\$30.495.000\text{ COP}}$. **100 % exacto.**
3. **Costos de la Calidad (CoQ, §5):**
   - Prevención (`2.3`, `4.1`, `5.4`, `5.5`): **33 h** · **$2.205.000 COP** ($7,23\%$).
   - Evaluación (`5.16`, `6.1`, `6.4`, `6.8`, `6.9`): **96 h** · **$6.905.000 COP** ($22,64\%$).
   - Fallos internos (`6.2`, `6.7`): **21 h** · **$1.140.000 COP** ($3,74\%$).
   - Total CoQ: **150 h** · **$10.250.000 COP** ($33,61\% \approx 33,6\%$ del costo directo). **100 % exacto.**
4. **Valor Ganado al 18/11/2026 (EVM, §6):**
   - $BAC = \$30.495.000\text{ COP}$.
   - $PV = \$22.995.000\text{ (Fases 1–5)} + \frac{2}{3}(\$1.935.000)_{6.1} + \$195.000_{6.7} + \frac{1}{2}(\$690.000)_{6.8} = \mathbf{\$24.825.000\text{ COP}}$ ($81,41\%$).
   - $EV = (\$22.995.000 - \$345.000_{5.4}) + 0,67(\$1.935.000)_{6.1} + \$195.000_{6.7} + 0,50(\$690.000)_{6.8} = \mathbf{\$24.486.450\text{ COP}}$ ($80,30\%$).
   - $SV = EV - PV = \mathbf{-\$338.550\text{ COP}}$ · $SPI = \frac{EV}{PV} = 0,98636 \approx \mathbf{0,986}$.
   - *Observación técnica del auditor:* La diferencia de $+\$6.450\text{ COP}$ entre el $SV$ ($-\$338.550$) y el costo de la única actividad atrasada (`5.4 Validación UCD`, $-\$345.000$) se debe a que en la actividad `6.1` el $PV$ tomó la fracción exacta de $\frac{2}{3}$ días ($66,6667\% \times \$1.935.000 = \$1.290.000$), mientras que el $EV$ tomó el porcentaje entero redondeado del XML ($67\% \times \$1.935.000 = \$1.296.450$), además de prorratear el costo fijo de $\$900.000$ que en el XML tiene `<FixedCostAccrual>3</FixedCostAccrual>` (causación al final de la tarea).

---

## 5. Matriz de Hallazgos Clasificados por Severidad

### 5.1 Hallazgos Críticos (0)

*No se detectaron hallazgos críticos. No existen vulnerabilidades de seguridad abiertas, pérdida de datos, exposición de credenciales ni errores en los cálculos presupuestales.*

### 5.2 Hallazgos Mayores (1)

| ID | Severidad | Componente / Ubicación | Descripción del hallazgo | Impacto |
|---|---|---|---|---|
| **HALL-01** | **Mayor** | `e2e/` · Actividades **EDT 6.9** y **EDT 5.4** | **Pendiente re-ejecución de suites E2E (Playwright) sobre el commit `2d85ae6`, verificación en dispositivo de `CP-32` y evidencia de `EDT 5.4` (UCD):** Las pruebas E2E (`CP-01…CP-30` y banco `BP-001…BP-100`) se ejecutaron por última vez el 16/11/2026. El commit `2d85ae6` (18/11/2026) modificó `app/src/componentes/PantallaPerfil.js` (agregando el bloque de foto de perfil encima del formulario) y `api/src/modules/ventas/ventas.service.js`. Aunque la regresión está cubierta en Jest, falta correr Playwright contra `2d85ae6` (programado en EDT 6.9 para el 20/11), incorporar `@CP-31` y `@CP-32` en `e2e/casos.js` y regularizar la actividad `EDT 5.4` (Validación UCD del 13/10, que figura al 0 % en el XML pese a que sus sucesoras `5.5` y `5.6` están al 100 %). | Condición obligatoria antes de liberar la versión final (`EDT 6.3`, 25/11/2026). Ya está identificada y planificada por el equipo. |

### 5.3 Hallazgos Menores (5)

| ID | Severidad | Componente / Ubicación | Descripción del hallazgo | Impacto |
|---|---|---|---|---|
| **HALL-02** | **Menor** | `api/src/modules/perfil/perfil.service.js:73` y `api/tests/integration/fase2/perfil_privacidad.test.js:76` | **Código HTTP en validación de tamaño de foto de perfil y prueba de límite de 300 KB:** En `perfil.routes.js:19`, Multer limita el archivo a `config.fotos.maxBytes` (300 KB) y `error-handler.js:23` devuelve **HTTP 413 `FOTO_MUY_GRANDE`** (tal como especifica `CP-32`). Sin embargo, la guarda defensiva en `perfil.service.js:73` lanza `errores.datosInvalidos(...)` (**HTTP 400**) en lugar de 413, y en `perfil_privacidad.test.js:76–83` no está automatizada la aserción con un buffer `> 300 KB` esperando HTTP 413. | Bajo. Por HTTP siempre responde 413 gracias a Multer, pero falta la aserción automática del límite de 300 KB en Jest. |
| **HALL-03** | **Menor** | `app/src/componentes/PantallaPerfil.js:77–79, 99` | **`fotoUrl` no se sincroniza en `SesionContext` tras actualizar la foto de perfil:** Cuando `cambiarFoto()` tiene éxito, actualiza el estado local `setFotoUrl(r.perfil.fotoUrl || null)`, pero no invoca `await actualizarUsuario({ fotoUrl: r.perfil.fotoUrl || null })` (y `guardar()` en la línea 99 tampoco incluye `fotoUrl`). Si el usuario cambia su foto, sale de la pantalla, pierde señal (`SIN_CONEXION`) y vuelve a abrir «Mi perfil», el fallback offline `mostrar(usuario)` (línea 46) no mostrará la foto recién actualizada hasta que `GET /auth/yo` o `GET /perfil` vuelva a responder con señal. | Cosmético / UX en modo sin conexión inmediatamente después de cambiar la foto. |
| **HALL-04** | **Menor** | `docs/pruebas/REGISTRO_DE_ERRORES.md:131` | **Cifra desactualizada en la tabla de la Sección 5 de `REGISTRO_DE_ERRORES.md`:** En §4b (línea 122) se reporta correctamente que la suite de Jest de la app pasó a **98/98** tras añadir la prueba de `CP-32` (ERR-17), pero en la tabla resumen de **§5 «Verificación de la versión 1.1.1» (línea 131)** quedó escrito `97/97`. | Inconsistencia documental menor entre secciones del mismo archivo. |
| **HALL-05** | **Menor** | `RESUMEN_REVISION_CODIGO.md:15` y `docs/pruebas/PLAN_Y_DISENO_PRUEBAS.md:20` | **Imprecisión en el conteo de módulos de la API («17 módulos» vs 16 carpetas / 17 montajes):** Ambos documentos afirman que existen «17 módulos», pero `api/src/modules/` tiene **16 subdirectorios** (15 con rutas HTTP + `correo`), la lista de `PLAN_Y_DISENO_PRUEBAS.md:20` enumera **16 elementos**, y `api/src/routes.js` tiene **17 llamadas a `router.use(...)`** bajo `/api/v1`. | Claridad documental para lectores o evaluadores externos. |
| **HALL-06** | **Menor** | `app/.env.example`, `01_Documentacion/03_Gestion/PRESUPUESTO_Y_CRONOGRAMA_AGROTECH.md:17` y `docs/GESTION_PROJECTLIBRE_COSTOS.md:281, 292` | **Detalles documentales menores en entorno y presupuesto:** (1) `app/app.config.js:9` lee `process.env.GOOGLE_SERVICES_JSON`, única variable de entorno del repositorio no comentada en `app/.env.example`; (2) el texto de §1 en `GESTION_PROJECTLIBRE_COSTOS.md` dice que en `01_Documentacion/03_Gestion` «hay dos archivos», lo cual describía el estado previo a la creación de `proyecto_agrotech_actualizado.xml` y `PRESUPUESTO_Y_CRONOGRAMA_AGROTECH.md` (ahora hay 4 archivos); (3) en §6 (EVM), conviene explicitar que el `+$6.450` de diferencia entre `SV = -$338.550` y el costo de `5.4` (`-$345.000`) proviene del redondeo de `2/3` a `67 %` en `6.1` y del prorrateo del costo fijo. | Documental / informativo. |

---

## 6. Correcciones Puntuales Recomendadas

A continuación se entregan las correcciones exactas (listas para aplicar) para subsanar las discrepancias menores detectadas durante la auditoría:

### 6.1 Corrección de **HALL-02** (`api/tests/integration/fase2/perfil_privacidad.test.js`)

Automatizar la verificación del límite de 300 KB (`413 FOTO_MUY_GRANDE`) en la prueba de integración de foto de perfil para completar la cobertura automática de `CP-32`:

```diff
--- a/api/tests/integration/fase2/perfil_privacidad.test.js
+++ b/api/tests/integration/fase2/perfil_privacidad.test.js
@@ -80,6 +80,9 @@ describe('CU-09 · Gestionar el perfil (RF-09 · AGRO-23)', () => {
     expect(r.status).toBe(200);
     expect(r.body.perfil.fotoUrl).toMatch(/\/fotos\/perfiles\/.+\.jpg$/);
     expect((await subir(Buffer.from('no es una foto'))).status).toBe(400);
+    const grande = await subir(jpeg(300 * 1024 + 1));
+    expect(grande.status).toBe(413);
+    expect(grande.body.error.codigo).toBe('FOTO_MUY_GRANDE');
   });
 });
```

### 6.2 Corrección de **HALL-03** (`app/src/componentes/PantallaPerfil.js`)

Persistir `fotoUrl` en la sesión local (`SesionContext`) cuando el usuario actualiza su foto de perfil:

```diff
--- a/app/src/componentes/PantallaPerfil.js
+++ b/app/src/componentes/PantallaPerfil.js
@@ -76,6 +76,7 @@ export function PantallaPerfil() {
       setEnviando(true);
       const r = await api.cambiarFotoPerfil(elegida.foto.uri);
       setFotoUrl(r.perfil.fotoUrl || null);
+      await actualizarUsuario({ fotoUrl: r.perfil.fotoUrl || null });
       setAviso({ tipo: 'info', mensaje: '✓ Foto de perfil actualizada.' });
     } catch (err) {
       if (err instanceof ErrorFoto) setAviso({ tipo: 'error', mensaje: err.message });
```

### 6.3 Corrección de **HALL-04** (`docs/pruebas/REGISTRO_DE_ERRORES.md`)

Actualizar el conteo de pruebas de la app de `97/97` a `98/98` en la tabla de la Sección 5:

```diff
--- a/docs/pruebas/REGISTRO_DE_ERRORES.md
+++ b/docs/pruebas/REGISTRO_DE_ERRORES.md
@@ -128,7 +128,7 @@ Insumo del análisis de errores del plan de métricas (Entrega 4) y de la gesti
 | Nivel | Resultado |
 |---|---|
 | API (Jest: unitarias + integración) | 244/244 |
-| App (Jest + Testing Library, SDK 58) | 97/97 |
+| App (Jest + Testing Library, SDK 58) | 98/98 |
 | Pruebas de sistema CP-01 … CP-30 (Playwright) | 51/51 pruebas · 28 PASA · 2 manuales |
 | Banco de pruebas BP-001 … BP-103 | 100/100 · 3 manuales |
 | Lint API y app | Sin errores |
```

### 6.4 Corrección de **HALL-05** (`RESUMEN_REVISION_CODIGO.md` y `docs/pruebas/PLAN_Y_DISENO_PRUEBAS.md`)

Precisar que existen **16 módulos** en `api/src/modules/` (15 de rutas REST montados en **17 rutas** bajo `/api/v1` más el módulo transversal `correo`):

```diff
--- a/RESUMEN_REVISION_CODIGO.md
+++ b/RESUMEN_REVISION_CODIGO.md
@@ -12,7 +12,7 @@
 
 | Carpeta | Qué se revisó | Estado |
 |---|---|---|
-| `api/` (Node 22 + Express 5 + PostgreSQL/PostGIS) | `src/server.js`, `app.js`, `routes.js`; 17 módulos en `src/modules/<módulo>/` con el patrón `routes → service → repository (+ validacion)`; middleware (autenticación, CORS, errores); `config/env.js`; almacenamiento local/S3; WebSocket; scripts | Organización consistente. Errores de PostgreSQL traducidos a HTTP en `error-handler.js` (UUID mal formado → 400, llaves duplicadas → 409) |
+| `api/` (Node 22 + Express 5 + PostgreSQL/PostGIS) | `src/server.js`, `app.js`, `routes.js` (17 montajes bajo `/api/v1`); 16 módulos en `src/modules/<módulo>/` (15 con rutas HTTP + `correo`) con el patrón `routes → service → repository (+ validacion)`; middleware (autenticación, CORS, errores); `config/env.js`; almacenamiento local/S3; WebSocket; scripts | Organización consistente. Errores de PostgreSQL traducidos a HTTP en `error-handler.js` (UUID mal formado → 400, llaves duplicadas → 409) |
```

### 6.5 Corrección de **HALL-06** (`app/.env.example`)

Documentar la variable opcional `GOOGLE_SERVICES_JSON` leída por `app/app.config.js`:

```diff
--- a/app/.env.example
+++ b/app/.env.example
@@ -2,3 +2,6 @@
 # así no hay que cambiar la IP cada vez que el router la reasigna. Para un servidor fijo escriba la URL completa,
 # por ejemplo http://192.168.1.20:3000 o https://api.agrotech.co (los builds de EAS la fijan en eas.json).
 EXPO_PUBLIC_API_URL=auto
+
+# Opcional (solo builds de EAS con Firebase Cloud Messaging para Android; en local basta colocar app/google-services.json):
+# GOOGLE_SERVICES_JSON=
```

---

## 7. Estado de cierre de los hallazgos (18/11/2026)

| ID | Estado | Corrección aplicada | Verificación |
|---|---|---|---|
| **HALL-01** | ⏳ PARCIAL (Mayor) · E2E resuelto | **Hecho (EDT 6.9, adelantada al 18/11):** Playwright 1.56 con Chromium 141 sobre `56c7134` (incluye los cambios de `2d85ae6`), API y web levantadas y detenidas por Playwright. **Pendiente:** probar CP-32 en un teléfono con Expo Go, agregar `@CP-31`/`@CP-32` a `e2e/casos.js` y regularizar la EDT 5.4 (UCD) | Sistema **51/51 pruebas · 28 PASA · 0 FALLA · 2 MANUAL** (173,6 s) · Banco **100/100 PASA** (555 llamadas HTTP, 2,0 min) · CP-21 y BP-096 («Mi perfil» con la foto) sin regresión · `docs/pruebas/evidencias/2026-11-18_e2e_*` |
| **HALL-02** | ✅ RESUELTO | `api/tests/integration/fase2/perfil_privacidad.test.js`: valores límite de la foto de perfil, exactamente 300 KB → 200 y 300 KB + 1 byte → **413 `FOTO_MUY_GRANDE`**. La guarda de `perfil.service.js` (400) se mantiene como defensa en profundidad: Multer corta antes y por HTTP siempre responde 413 | `perfil_privacidad.test.js` **10/10 PASS** (11,2 s) |
| **HALL-03** | ✅ RESUELTO | `app/src/componentes/PantallaPerfil.js`: `cambiarFoto()` llama a `actualizarUsuario({ fotoUrl })`. Además, el perfil se carga una vez por usuario (`usuario.id`) y no cada vez que cambia la sesión: con el parche propuesto tal cual, `actualizarUsuario` disparaba de nuevo `GET /perfil` y borraba los cambios del formulario sin guardar | `app/__tests__/fase2.test.js` **12/12 PASS** (14,0 s): la sesión guardada tiene la nueva `fotoUrl`, se hace un solo `GET /perfil` y el cambio sin guardar se conserva · `expo lint` sin errores |
| **HALL-04** | ✅ RESUELTO | `docs/pruebas/REGISTRO_DE_ERRORES.md` §5: App **98/98**. Las filas de ERR-02 y ERR-04 conservan 97/97 porque registran la verificación de su fecha (16/11) | Revisión documental |
| **HALL-05** | ✅ RESUELTO | `RESUMEN_REVISION_CODIGO.md` y `docs/pruebas/PLAN_Y_DISENO_PRUEBAS.md`: **16 módulos** en `api/src/modules/` (15 con rutas HTTP + `correo`) expuestos en **17 montajes** bajo `/api/v1` (`mensajes` y `calificaciones` también anidados en `/pedidos/:id/…`) | `ls api/src/modules` = 16 · `router.use(` en `routes.js` = 17 |
| **HALL-06** | ✅ RESUELTO | (1) `app/.env.example`: `GOOGLE_SERVICES_JSON` documentada y comentada. (2) `docs/GESTION_PROJECTLIBRE_COSTOS.md` §1 y su copia en `03_Gestion`: la carpeta pasó de 2 a 4 archivos. (3) §6: los +$ 6.450 del SV vienen **solo** del redondeo de la 6.1, (0,67 − 2/3) × $ 1.935.000 = $ 6.450. El costo fijo de la 6.1 se prorratea igual en PV y EV, así que no influye en la diferencia; se aclaró que ProjectLibre lo causa al final de la tarea | Revisión documental y aritmética |

**Ejecución de verificación:** secuencial, en primer plano, con el Node 24.22 de Windows y PostgreSQL 17 + PostGIS en `localhost:5434`. Lint de la API y de la app sin errores. Los totales de las suites no cambian (API 244, app 98): se agregaron aserciones a pruebas existentes.

**Veredicto actualizado:** 0 Críticos · 1 Mayor parcialmente resuelto (HALL-01: E2E y banco en verde sobre `56c7134`; queda CP-32 en el teléfono, `@CP-31`/`@CP-32` en Playwright y la EDT 5.4) · 0 Menores abiertos.
