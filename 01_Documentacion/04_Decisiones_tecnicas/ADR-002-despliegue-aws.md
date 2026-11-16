# ADR-002 · Despliegue de producción en AWS

| Campo | Valor |
|---|---|
| Estado | Propuesta para aprobación del Project Manager (11/10/2026) |
| Alcance | MVP · Fase 7 |
| Tarjeta Jira | AGRO-16 |
| Requisitos | RNF-04 (seguridad), RNF-07 (disponibilidad), RNF-09 (consumo de datos) |

## Contexto

- El diagrama de despliegue (Entrega 3) fija: ALB HTTPS/WSS → EC2 (Node.js 22 + gestor de procesos) → RDS PostgreSQL 17 + PostGIS en subred privada; fotos en S3.
- Faltaba decidir cómo se crea la infraestructura, cómo llegan los secretos al servidor, cómo se publican versiones y cómo se sirven las fotos.

## Decisiones

| Aspecto | Decisión | Justificación |
|---|---|---|
| Infraestructura | Plantilla CloudFormation única (`infra/agrotech.yaml`), validada con `cfn-lint` | Reproducible y revisable en PR; no requiere herramientas fuera de AWS |
| Gestor de procesos | `systemd` con endurecimiento (`ProtectSystem=strict`, `NoNewPrivileges`) | Viene con Ubuntu; reinicio automático; sin dependencias extra |
| Secretos | SSM Parameter Store (SecureString) + Secrets Manager para RDS; se leen al arrancar con el rol de la instancia | Ningún secreto en el repositorio, la AMI, el UserData ni GitHub |
| Acceso al servidor | SSM Session Manager; sin puerto 22 | Menor superficie de ataque; auditoría en CloudTrail |
| Publicación | Etiqueta `v*` → GitHub Actions con OIDC → S3 → SSM Run Command → `desplegar.sh` con verificación de `/salud` y reversión automática | Sin llaves de AWS de larga vida; versión anterior disponible en segundos |
| Fotos | La API sube a S3 con el rol de EC2; el teléfono descarga directo del bucket (lectura pública solo de `productos/`), caché inmutable de 30 días | Coincide con el diagrama (HTTPS GET a S3); descarga la API; menos datos móviles en reintentos |
| Base de datos | TLS verificado (`sslmode=verify-full` con la CA de RDS), `rds.force_ssl=1`, cifrado en reposo, 7 días de copias | RNF-04 y RNF-07 |
| Monitoreo | Alarmas CloudWatch → SNS (correo): servidor no sano, 5xx, p95 > 1 s, espacio/CPU de RDS | Detecta caídas sin herramientas adicionales |

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Nginx en la instancia como proxy TLS | Duplica al ALB del diagrama; renovación de certificados manual |
| Elastic Beanstalk / contenedores (ECS) | Más piezas que operar para un piloto de un solo proceso |
| CloudFront delante de S3 | Mejor latencia, pero agrega costo y configuración; se puede añadir sin cambiar la app (`FOTOS_URL_BASE`) |
| Llaves de acceso de IAM en GitHub o en `.env` | Riesgo de filtración; OIDC y roles de instancia lo evitan |

## Consecuencias

- Las migraciones deben ser aditivas para que la reversión de código sea segura (regla agregada a `docs/CONTRIBUTING.md`; las migraciones 001–005 la cumplen).
- Un solo EC2 es punto único de falla: aceptado para el piloto; la siguiente fase activa Multi-AZ en RDS y un grupo de autoescalado de 2 instancias detrás del mismo ALB.
- El costo de referencia es ≈ 55 USD/mes (ver `docs/despliegue/RUNBOOK.md`).
