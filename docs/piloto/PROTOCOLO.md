# Protocolo del piloto · AGRO-15

| Campo | Valor |
|---|---|
| Objetivo | Verificar con usuarios reales de la asociación los criterios de aceptación CA-01…CA-12 y, en particular, **CA-12 / CP-12 (RNF-02)**: ≥ 80 % de éxito sin ayuda en las tareas críticas y SUS ≥ 68 |
| Fechas | 26/11 – 01/12/2026 (EDT 6.4); versión final publicada el 25/11 (EDT 6.3) |
| Versión probada | APK `piloto` (`eas build --profile piloto`) contra la API de producción en AWS |
| Responsables | Moderación: Julio Carrillo · Observación y registro: Julio Durán · Soporte técnico y monitoreo: Geron Vergara |
| Método | Prueba de usabilidad moderada, en persona, con pensamiento en voz alta + cuestionario SUS + entrevista breve |

## 1. Participantes

| Grupo | Cantidad | Criterio de inclusión | Justificación |
|---|---|---|---|
| Productores (P01…P05) | 5 – 8 | Asociado activo, vende al menos una vez al mes, usa celular Android propio | 5 usuarios por perfil detectan la mayoría de los problemas de usabilidad (Nielsen y Landauer, 1993); 8 dan un IC más estrecho para el SUS |
| Consumidores (C01…C05) | 5 – 8 | Compra productos agrícolas en Cúcuta, Pamplona u Ocaña | Mismo criterio |

- Se busca variedad en edad, experiencia con el celular (1–5) y señal del lugar.
- Exclusión: integrantes del equipo y personas que participaron en la validación de prototipos (sesgo de aprendizaje).
- Participación voluntaria, con consentimiento firmado ([CONSENTIMIENTO.md](CONSENTIMIENTO.md)).

## 2. Materiales

| Material | Cantidad | Nota |
|---|---|---|
| Teléfono Android de gama baja (≤ 3 GB RAM, Android ≥ 8) con el APK | 2 | Uno por rol; batería ≥ 80 %; sin wifi, con datos móviles |
| Guion de tareas y hojas de observación impresas | 1 por participante | [GUION_TAREAS.md](GUION_TAREAS.md) |
| Cuestionario SUS impreso | 1 por participante | [CUESTIONARIO_SUS.md](CUESTIONARIO_SUS.md) |
| Consentimiento impreso | 2 por participante | Una copia para la persona |
| Cronómetro, grabadora de audio (solo con autorización) | 1 | |
| Teléfono del equipo con cuenta de prueba | 1 | Genera pedidos y mensajes para P4–P5 |

## 3. Procedimiento de cada sesión (≈ 40 min)

| Paso | Duración | Acción |
|---|---|---|
| 1 | 5 min | Bienvenida; se aclara que **se evalúa la aplicación, no a la persona**. Lectura y firma del consentimiento |
| 2 | 3 min | Datos del participante (código, rol, municipio, rango de edad, experiencia con el celular, señal) |
| 3 | 20 min | Tareas del guion en orden, pensando en voz alta. El moderador no explica la interfaz; aplica la regla de ayuda |
| 4 | 5 min | Cuestionario SUS, leído en voz alta si la persona lo prefiere |
| 5 | 5 min | Entrevista de cierre (3 preguntas del guion) |
| 6 | 2 min | Agradecimiento; se pregunta si desea conservar su cuenta (si no, se elimina según §7) |

## 4. Métricas e instrumentos

| Métrica (ISO/IEC 25010 · usabilidad) | Fórmula | Meta | Instrumento |
|---|---|---|---|
| Efectividad: éxito sin ayuda en tareas críticas (P2, C3) | EXITO ÷ intentos × 100 | ≥ 80 % | `tareas.csv` |
| Eficiencia: tiempo por tarea | media de `tiempo_s` en éxitos | Referencia para la siguiente versión | `tareas.csv` |
| Eficiencia: toques hasta completar | media de `toques` | ≤ 3 desde la pantalla de inicio (RNF-02) | `tareas.csv` |
| Satisfacción: SUS | (Σ impares − 5 + 25 − Σ pares) × 2,5 | ≥ 68 | `sus.csv` |
| Sincronización sin error (RNF-03) | operaciones `PUBLICADO` ÷ operaciones recibidas por `/sync/push` × 100 | ≥ 98 % | Tabla `operacion_sync` (consulta en REGISTRO_RESULTADOS §4) |
| Disponibilidad (RNF-07) | TMDF ÷ (TMDF + TMDR) × 100 | ≥ 99 % | Alarmas de CloudWatch y bitácora de incidentes |
| Densidad de defectos | defectos del piloto ÷ PF entregados | ≤ 0,1 | Bugs en Jira con etiqueta `piloto` |

Cálculo: `npm run piloto:informe -- --sus datos/sus.csv --tareas datos/tareas.csv --salida INFORME_CP12.md` (media, desviación, IC 95 % y veredicto).

## 5. Criterio de aceptación del piloto

| Resultado | Decisión |
|---|---|
| SUS ≥ 68 **y** éxito en tareas críticas ≥ 80 % | **CP-12 PASA** → se firma el acta de aceptación con la asociación |
| Alguna meta no se cumple | **CP-12 FALLA** → plan de contingencia del Riesgo 2 (Entrega 4): se prioriza el rediseño de las pantallas con más fallos sobre funciones nuevas y se repite la prueba con 3–5 usuarios nuevos |
| Defecto crítico (pérdida de datos, cobro incorrecto, caída) | Se detiene el piloto; se corrige (meta ≤ 48 h, tiempo medio de cambio) y se reanuda |

## 6. Gestión de incidentes durante el piloto

| Situación | Acción inmediata | Registro |
|---|---|---|
| La app se cierra o no responde | Anotar la tarea y la hora; reiniciar; continuar con la siguiente tarea | Bug en Jira (`piloto`, severidad) |
| Sin señal en el lugar | Es parte de la prueba (CA-04); si impide toda la sesión, cambiar de lugar | Bitácora |
| Alarma de CloudWatch (servidor no sano, 5xx) | Soporte revisa `journalctl -u agrotech-api`; si hace falta, revierte la versión (RUNBOOK §6) | Bitácora de disponibilidad |
| El participante se siente incómodo | Se detiene la sesión; sus datos se descartan si lo pide | Bitácora |

## 7. Ética y protección de datos

- Consentimiento informado y autorización de tratamiento de datos según la Ley 1581 de 2012.
- Las planillas usan solo códigos (P01, C01); la tabla código–persona queda en papel, bajo custodia del responsable del piloto, y se destruye al cerrar la asignatura.
- No se fotografían rostros. El audio solo se graba con autorización expresa y se elimina tras transcribir los hallazgos.
- Las cuentas creadas en el piloto se eliminan a solicitud del participante (la gestión de datos personales en la app, RF-20, es de Fase 2: el administrador lo hace directamente en la base y lo anota en la bitácora).

## Referencias

- Bangor, A., Kortum, P. y Miller, J. (2009). Determining what individual SUS scores mean: Adding an adjective rating scale. *Journal of Usability Studies, 4*(3), 114–123.
- Brooke, J. (1996). SUS: A "quick and dirty" usability scale. En *Usability evaluation in industry* (pp. 189–194). Taylor & Francis.
- ISO/IEC 25010:2011. *Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*.
- Nielsen, J. y Landauer, T. K. (1993). A mathematical model of the finding of usability problems. *Proceedings of INTERCHI '93*, 206–213.
- Sauro, J. y Lewis, J. R. (2016). *Quantifying the user experience* (2.ª ed.). Morgan Kaufmann.
