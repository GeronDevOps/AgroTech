# Cuestionario SUS · AgroTech

*System Usability Scale* (Brooke, 1996), versión en español sencillo. Solo se reemplaza «el sistema» por «la aplicación», práctica aceptada que no altera la validez del instrumento. **No cambiar el orden ni el sentido de las frases**: las impares son positivas y las pares negativas, y así se calcula el puntaje.

**Instrucciones para leer en voz alta:** «Le voy a leer 10 frases sobre la aplicación que acaba de usar. Para cada una, dígame qué tan de acuerdo está, del 1 al 5: 1 es *nada de acuerdo* y 5 es *totalmente de acuerdo*. No hay respuestas buenas ni malas; responda lo primero que piense.»

Código del participante: ______ Rol: ☐ Productor ☐ Consumidor Fecha: ____/____/2026

| # | Frase | 1<br>Nada de acuerdo | 2 | 3 | 4 | 5<br>Totalmente de acuerdo |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 1 | Creo que me gustaría usar esta aplicación seguido. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | La aplicación me pareció más complicada de lo necesario. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | La aplicación me pareció fácil de usar. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | Creo que necesitaría que alguien que sepa me ayude para poder usar la aplicación. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Las partes de la aplicación funcionan bien juntas. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | La aplicación tiene muchas cosas que no son coherentes entre sí. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | Creo que la mayoría de la gente aprendería a usar esta aplicación muy rápido. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | La aplicación me pareció muy enredada de usar. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | Me sentí muy seguro(a) usando la aplicación. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Tuve que aprender muchas cosas antes de poder manejar la aplicación. | ☐ | ☐ | ☐ | ☐ | ☐ |

## Cómo se calcula (lo hace `npm run piloto:informe`)

| Paso | Regla |
|---|---|
| Frases impares (1, 3, 5, 7, 9) | respuesta − 1 |
| Frases pares (2, 4, 6, 8, 10) | 5 − respuesta |
| Puntaje del participante | suma de los 10 valores × 2,5 → de 0 a 100 |
| Puntaje del piloto | media de los participantes, con IC 95 % |

| Puntaje medio | Adjetivo (Bangor et al., 2009) | Lectura para CP-12 |
|---|---|---|
| ≥ 85,5 | Excelente | Cumple |
| 71,4 – 85,4 | Bueno | Cumple |
| 68,0 – 71,3 | Aceptable (sobre el promedio) | Cumple (meta ≥ 68) |
| 50,9 – 67,9 | Aceptable (bajo el promedio) | **No cumple** |
| < 50,9 | Pobre / Pésimo | **No cumple** |

## Digitación

Una fila por participante en `datos/sus.csv` (copiar de `plantillas/sus.csv`), con las respuestas tal como las marcó (1–5), **sin invertir nada**:

```csv
participante,rol,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10
P01,PRODUCTOR,4,2,5,1,4,2,4,2,4,3
```
