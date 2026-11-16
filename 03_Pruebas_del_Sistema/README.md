# 03 · Pruebas del sistema

| Carpeta | Contenido | Resultado |
|---|---|---|
| [`01_Casos_CP_Entrega5`](01_Casos_CP_Entrega5) | Casos de prueba CP-01 a CP-30 (Entrega 5): informe y matriz de trazabilidad, capturas por paso, consolas, registros, informe HTML de Playwright y retos | 28 PASA · 2 manuales |
| [`02_Banco_de_pruebas`](02_Banco_de_pruebas) | Banco BP-001 a BP-103 diseñado con técnicas de caja negra: documento (.docx/.pdf), resultados (JSON, Markdown, JUnit), capturas, consolas, informe HTML y retos | 100 PASA · 3 manuales · 300/300 en 3 repeticiones |
| [`03_MVP_v1.0.0`](03_MVP_v1.0.0) | Informe de pruebas del MVP (Fase 7) | — |
| [`04_Registro_de_errores`](04_Registro_de_errores) | Registro de errores ERR-01 a ERR-12: síntoma, causa raíz, severidad, solución y verificación (.docx/.pdf/.md) | 16 corregidos · 1 mitigado |

Los informes HTML se abren descargando la carpeta y abriendo `index.html` en el navegador.
Para volver a ejecutar las pruebas: `cd 02_Codigo/agrotech/e2e && npm run preparar && npm test && npm run banco`.
