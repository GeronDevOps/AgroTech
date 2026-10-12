# Registro de resultados del piloto · AGRO-15

Se llena durante el piloto. Los datos cuantitativos van en `datos/sus.csv` y `datos/tareas.csv`; este documento recoge sesiones, hallazgos, incidentes y la conclusión.

## 1. Sesiones

| Fecha | Lugar (vereda / municipio) | Código | Rol | Señal | Moderador | Duración | Observaciones |
|---|---|---|---|---|---|---|---|
| | | P01 | Productor | | | | |
| | | C01 | Consumidor | | | | |

## 2. Hallazgos de usabilidad

Severidad según Nielsen (1994): **0** no es problema · **1** cosmético · **2** menor · **3** mayor (prioridad alta) · **4** catástrofe (corregir antes de liberar).

| ID | Tarea | Pantalla | Problema observado | Participantes afectados | Severidad | Causa probable (Ishikawa) | Acción propuesta | Jira |
|---|---|---|---|---|---|---|---|---|
| H-01 | | | | /n | | Diseño de interfaz · Datos y sincronización · Código · Requisitos | | AGRO- |

**Priorización:** severidad × participantes afectados. Los hallazgos 3–4 se corrigen en la EDT 6.2 (corrección de errores) antes del acta.

## 3. Defectos (Bugs) del piloto

| Jira | Descripción | Origen | Severidad | Detectado | Corregido | Horas |
|---|---|---|---|---|---|---|
| AGRO- | | Requisitos · Diseño · Código · Datos/sync · Pruebas | | | | |

Indicadores (Entrega 4, métricas de calidad):

| Indicador | Fórmula | Valor | Meta |
|---|---|---|---|
| Densidad de defectos | defectos del piloto ÷ PF entregados | | ≤ 0,1 |
| EED | E ÷ (E + D); E = errores antes de entregar, D = defectos del piloto | | ≥ 0,90 |
| Tiempo medio de cambio | media de horas para corregir un defecto crítico | | ≤ 48 h |

## 4. Sincronización y disponibilidad

Sincronización sin error (RNF-03), consulta de solo lectura sobre producción:

```sql
SELECT count(*)                                                     AS recibidas,
       count(*) FILTER (WHERE resultado = 'PUBLICADO')              AS publicadas,
       count(*) FILTER (WHERE respuesta->>'codigo' = 'CONFLICTO_VERSION') AS conflictos,
       round(100.0 * count(*) FILTER (WHERE resultado = 'PUBLICADO')
             / NULLIF(count(*) FILTER (WHERE respuesta->>'codigo' IS DISTINCT FROM 'CONFLICTO_VERSION'), 0), 1)
                                                                    AS porcentaje_sin_error
FROM operacion_sync
WHERE procesado_en BETWEEN '2026-11-26' AND '2026-12-02';
```

> Un `CON_ERROR` por conflicto de versión (CU-17 A2) es el comportamiento esperado (prevalece el servidor), no una falla: se cuenta aparte y no entra en el denominador.

| Indicador | Valor | Meta |
|---|---|---|
| Operaciones de la cola publicadas sin error | | ≥ 98 % |
| Conflictos de versión (CON_ERROR esperados) | | — |

Bitácora de disponibilidad (alarmas de CloudWatch):

| Inicio de la falla | Fin | Duración (TMDR) | Causa | Acción |
|---|---|---|---|---|
| | | | | |

Disponibilidad = TMDF ÷ (TMDF + TMDR) × 100 = ______ % (meta ≥ 99 %).

## 5. Resultado de CP-12

Pegar aquí la salida de:

```bash
cd api && npm run piloto:informe -- --sus ../docs/piloto/datos/sus.csv --tareas ../docs/piloto/datos/tareas.csv --salida ../docs/piloto/INFORME_CP12.md
```

## 6. Criterios de aceptación validados por el usuario

| CA | Validación por el usuario (Entrega 2) | Tarea del guion | ¿Validado? | Evidencia |
|---|---|---|---|---|
| CA-01 | Crea su cuenta e ingresa sin ayuda | P1, C1 | ☐ | |
| CA-02 | Comprueba que no puede entrar sin sus credenciales | (demostración) | ☐ | |
| CA-03 | Ve el producto en «Mis productos» y un consumidor en el catálogo | P2 + C2 | ☐ | |
| CA-04 | Apaga y enciende los datos y ve el cambio de estado | P3 | ☐ | |
| CA-05 | Encuentra el producto buscado usando un filtro | C2 | ☐ | |
| CA-06 | Ve su comprobante y el productor ve el pedido nuevo | C3 + P4 | ☐ | |
| CA-07 | Entiende qué debe corregir si falta cantidad | (demostración) | ☐ | |
| CA-08 | El consumidor ve cada cambio de su pedido | P4 + C5 | ☐ | |
| CA-09 | Ambos ven el mismo historial de chat | P5 + C4 | ☐ | |
| CA-10 | La calificación aparece en el perfil del productor | C6 | ☐ | |
| CA-11 | Confirma las cifras con sus propios registros | P6 | ☐ | |
| CA-12 | ≥ 80 % completa publicar y comprar; SUS ≥ 68 | P2, C3 + SUS | ☐ | INFORME_CP12.md |

## 7. Conclusión y acta

| Campo | Valor |
|---|---|
| Veredicto CP-12 | PASA / FALLA |
| Hallazgos severidad 3–4 abiertos | |
| Decisión | Aceptado · Aceptado con observaciones · Repetir prueba |
| Firma representante de la asociación | |
| Firma Project Manager | |
| Fecha | |
