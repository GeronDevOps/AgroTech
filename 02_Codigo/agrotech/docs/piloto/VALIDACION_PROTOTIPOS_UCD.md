# Validación de prototipos de baja fidelidad (UCD) · AGRO-17

| Campo | Valor |
|---|---|
| Objetivo | Comprobar con productores de la asociación que los 5 wireframes de tareas críticas se entienden y se pueden recorrer sin ayuda, antes del piloto |
| Fecha | 13/10/2026 (EDT 5.4 del cronograma) · duración 1 día |
| Responsable | Julio Carrillo (ejecuta) · Julio Durán (aprueba) |
| Insumo | `AgroTech_10_Wireframes_UCD` (5 pantallas) impreso en tamaño real de teléfono, una hoja por pantalla y por estado |
| Participantes | 5 productores (distintos a los del piloto) con diferente experiencia con el celular |
| Método | Prototipo en papel con el moderador como «computador» (cambia la hoja según lo que la persona toca) + prueba de reconocimiento de íconos + comparación con la pantalla ya implementada |

## 1. Pantallas y preguntas

| # | Wireframe | Tarea en papel | Pregunta de comprensión | Criterio de éxito |
|---|---|---|---|---|
| 1 | Inicio del productor | «¿Dónde tocaría para ver si alguien le compró?» | «¿Qué significa *2 nuevos*?» | Toca «Mis pedidos» al primer intento |
| 2 | Publicar (≤ 3 toques) | «Publique 20 bultos de papa a 85.000 el bulto.» | «Si no tiene señal, ¿qué pasa con su publicación?» | Recorre foto → producto → cantidad → precio → PUBLICAR en ≤ 3 toques desde el inicio; entiende el aviso «Sin señal» |
| 3 | Catálogo con filtros | (Rol comprador) «Busque cebolla de Ocaña.» | «¿Por qué *Agregar* está en gris?» | Usa el filtro de municipio; relaciona el gris con la falta de señal |
| 4 | Confirmar pedido | «Compre lo que tiene en el carrito para recoger en la mañana.» | «¿Cuántos pedidos se van a crear y por qué?» | Elige punto y franja y confirma; entiende un pedido por productor |
| 5 | Panel de ventas | «¿Cuánto vendió en octubre?» | «¿Qué producto se vendió más?» | Lee los ingresos y el más vendido sin ayuda |

## 2. Reconocimiento de íconos (sin texto)

Se muestra cada ícono **solo** y se pregunta «¿Qué cree que hace este botón?». Meta: ≥ 4 de 5 aciertos por ícono; si no, se mantiene siempre acompañado de texto (ya es la regla) y se evalúa cambiarlo.

| Ícono | Significado | Aciertos (/5) | Respuestas erradas más comunes |
|---|---|---|---|
| ＋ | Publicar producto | | |
| ▤ | Mis pedidos | | |
| ▲ | Mis ventas | | |
| ✉ | Mensajes | | |
| ⏳ | Pendiente por sincronizar | | |
| Chip «En línea» / «Sin señal» | Estado de conexión | | |

## 3. Lista de verificación UCD (principios RNF-02 del wireframe)

| Principio | Verificación en la app implementada | Cumple |
|---|---|---|
| Ícono + texto en cada acción | `Mosaico`, `BotonGrande` y la barra inferior del consumidor siempre muestran texto | ☐ |
| Botones de al menos 48 dp | `toque.minimo` = 48 y `toque.boton` en `src/tema/tema.js` | ☐ |
| Contraste alto (verde oscuro sobre blanco) | Paleta `colores.primario` sobre `colores.fondo` | ☐ |
| Una tarea por pantalla | Registro en 2 pasos; publicar en una sola pantalla con secciones numeradas | ☐ |
| Teclado numérico y selectores en lugar de texto libre | Precio y cantidad con teclado numérico; municipio, categoría y unidad con selectores | ☐ |
| Indicador permanente de conexión y última sincronización | `IndicadorConexion` en el encabezado; aviso «Sin señal» con fecha de los datos | ☐ |
| Acciones que exigen red deshabilitadas con explicación | «Crear cuenta» y «Confirmar pedido» deshabilitados sin señal, con el motivo | ☐ |
| Accesibilidad para lector de pantalla | Etiquetas accesibles en tarjetas, chips y botones (verificadas por la suite E2E, que navega por ellas) | ☐ |

## 4. Trazabilidad wireframe → pantalla implementada

| Wireframe | Pantalla en la app | Decisión UCD que se conservó | Diferencia con el wireframe (a validar) | Evidencia |
|---|---|---|---|---|
| 1. Inicio del productor | `app/productor/index.js` | Mosaicos grandes con ícono + texto y contador de pedidos por atender | Se agregó el mosaico «Mensajes» con no leídos y el aviso de cambios sin enviar | `docs/fase2_pantallas.png`, `docs/fase6_pantallas.png` |
| 2. Publicar | `app/productor/publicar.js` | Productos frecuentes como chips, cantidad con −/+, municipio del perfil | Foto desde cámara **o** galería; descripción opcional | `docs/fase3_pantallas.png`, `docs/fase5_pantallas.png` |
| 3. Catálogo | `app/consumidor/index.js` | Filtros en chips (municipio, categoría, precio); aviso sin señal con fecha | Cuadrícula de 2 columnas en lugar de lista; «Agregar» se hace en el detalle | `docs/fase3_pantallas.png` |
| 4. Confirmar pedido | `app/consumidor/carrito.js` | Un pedido por productor, punto y franja de entrega | Se agregó pago en línea opcional (ADR-001) | `docs/fase4_pantallas.png` |
| 5. Panel de ventas | `app/productor/ventas.js` | Indicadores grandes, gráfico simple y más vendidos | Periodos (semana, mes, mes anterior, año) en lugar de selector de mes | `docs/fase6_pantallas.png` |

## 5. Procedimiento (≈ 30 min por persona)

1. Consentimiento ([CONSENTIMIENTO.md](CONSENTIMIENTO.md), adaptado a «prueba de bocetos»).
2. Reconocimiento de íconos (§2), antes de ver cualquier pantalla.
3. Tareas en papel (§1), en orden 1 → 5, pensando en voz alta.
4. La misma tarea 2 (publicar) en el teléfono con la app real, para comparar: ¿qué le resultó más claro y por qué?
5. Preguntas de cierre: «¿Qué palabra no entendió?», «¿Qué le sobra o le falta a la pantalla?».

## 6. Registro de hallazgos

| ID | Pantalla | Hallazgo | Participantes | Severidad (0–4) | Cambio propuesto | ¿Ya resuelto en la app? | Jira |
|---|---|---|---|---|---|---|---|
| UCD-01 | | | /5 | | | | AGRO- |

**Regla de decisión:** severidad ≥ 3 o ≥ 3 de 5 participantes afectados → tarjeta en Jira con prioridad alta antes del piloto. Las palabras que no se entiendan se reemplazan en todas las pantallas (glosario único de la app).

## 7. Resultado

| Indicador | Valor | Meta |
|---|---|---|
| Tareas en papel completadas sin ayuda | __ / 25 | ≥ 80 % |
| Íconos reconocidos (promedio) | __ % | ≥ 80 % |
| Hallazgos severidad 3–4 | | 0 abiertos antes del piloto |

Firma de quien ejecuta: ____________ Firma de quien aprueba: ____________ Fecha: ____/____/2026
