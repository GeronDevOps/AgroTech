# Guion de tareas del piloto · CP-12

- **Formato:** prueba moderada, en persona, con el método de pensamiento en voz alta.
- **Equipo:** teléfono Android de gama baja con el APK del piloto; datos móviles reales (sin wifi).
- **Tareas críticas (CA-12, meta de éxito sin ayuda ≥ 80 %):** **P2 · Publicar producto** y **C3 · Confirmar pedido** (Entrega 2, CA-12; Entrega 4, métrica de usabilidad).
- **Regla de ayuda:** si la persona lleva 60 s sin avanzar o pide ayuda dos veces, el moderador da **una** pista y la tarea se registra como `AYUDA`. Si no termina en el tiempo máximo: `FALLO`.

## Codificación del resultado (columna `resultado` de `tareas.csv`)

| Código | Significado |
|---|---|
| `EXITO` | Completó la tarea sin ninguna ayuda, dentro del tiempo máximo |
| `AYUDA` | La completó, pero con una pista del moderador |
| `FALLO` | No la completó, abandonó o superó el tiempo máximo |

Además se anotan: `tiempo_s` (desde que termina de leerse la tarea hasta el resultado), `errores` (toques en un lugar equivocado que obligan a volver) y `toques` (toques hasta completar, para verificar la regla de máximo tres toques del RNF-02).

## Productor (participantes P)

Preparación: cuenta creada en la sesión (P1). Para P4–P5, el equipo genera desde otro teléfono un pedido y un mensaje a esa cuenta.

| Código | CU / CA | Texto para leer en voz alta | Criterio de éxito | Tiempo máx. |
|---|---|---|---|---|
| P1 | CU-01 · CA-01 | «Usted quiere vender en AgroTech. Cree su cuenta como productor.» | Llega a «Hola, …» con rol productor y la autorización aceptada | 5 min |
| **P2** | **CU-02 · CA-03** | «Hoy sacó 10 bultos de papa. Publíquelos a 85.000 pesos el bulto, con una foto.» | Aparece en «Mis productos» como **Activa** con foto, cantidad y precio correctos | 4 min |
| P3 | CU-17 · CA-04 | «Ponga el teléfono en modo avión. Ahora publique 20 kilos de cebolla a 3.000 el kilo. Luego quite el modo avión.» | Ve «Pendiente por sincronizar» y luego la publicación activa sin volver a escribir nada | 5 min |
| P4 | CU-13 · CA-08 | «Le llegó un pedido. Acéptelo y, cuando lo entregue, márquelo como entregado.» | El pedido termina en **Entregado** sin saltos | 3 min |
| P5 | CU-05 · CA-09 | «El comprador le escribió. Contéstele que entrega mañana a las 9.» | El mensaje aparece en el chat con su hora | 2 min |
| P6 | CU-07 · CA-11 | «¿Cuánta plata ha vendido este mes en AgroTech?» | Dice la cifra que muestra «Ingresos del periodo» | 2 min |

## Consumidor (participantes C)

Preparación: el catálogo tiene publicaciones activas de al menos 3 municipios.

| Código | CU / CA | Texto para leer en voz alta | Criterio de éxito | Tiempo máx. |
|---|---|---|---|---|
| C1 | CU-01 · CA-01 | «Cree su cuenta para comprar en AgroTech.» | Llega al catálogo con rol consumidor | 5 min |
| C2 | CU-03 · CA-05 | «Busque qué productos hay de Ocaña.» | El catálogo muestra solo productos de Ocaña | 2 min |
| **C3** | **CU-04 · CA-06** | «Compre 2 bultos de papa para recoger en el parque principal en la mañana.» | Ve «Pedido confirmado» con el total correcto | 4 min |
| C4 | CU-05 · CA-09 | «Pregúntele al productor si la papa viene lavada.» | El mensaje queda enviado en el chat de ese pedido | 2 min |
| C5 | CU-15 · CA-08 | «¿En qué va su pedido?» | Dice el estado vigente que muestra «Mis pedidos» | 1 min |
| C6 | CU-06 · CA-10 | (Tras marcarlo entregado el equipo) «Califique al productor.» | La calificación queda guardada | 2 min |

## Hoja de observación (una por participante)

| Campo | Valor |
|---|---|
| Código del participante | P__ / C__ |
| Rol · municipio · edad (rango) | |
| Experiencia con el celular (1 = nunca usa apps · 5 = usa apps a diario) | |
| Señal en el lugar (sin señal · 2G · 3G · 4G) | |
| Moderador / anotador | |

| Tarea | Resultado (EXITO · AYUDA · FALLO) | Tiempo (s) | Toques | Errores | Qué dijo o hizo (citas textuales) | Problema observado |
|---|---|---|---|---|---|---|
| P1 / C1 | | | | | | |
| P2 / C2 | | | | | | |
| P3 / C3 | | | | | | |
| P4 / C4 | | | | | | |
| P5 / C5 | | | | | | |
| P6 / C6 | | | | | | |

Preguntas de cierre (después del SUS):

1. ¿Qué fue lo más difícil?
2. ¿Qué cambiaría de la aplicación?
3. ¿La recomendaría a otro productor o comprador de la asociación? ¿Por qué?
