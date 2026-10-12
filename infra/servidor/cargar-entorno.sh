#!/usr/bin/env bash
# AGRO-16 · Arma /etc/agrotech/api.env con la configuración de producción.
#   - Secretos desde SSM Parameter Store (/agrotech/<entorno>/NOMBRE, SecureString) y Secrets Manager (RDS).
#   - Nada sensible queda en el repositorio, en la AMI ni en el UserData.
# Lo ejecutan systemd (ExecStartPre=+, como root) y desplegar.sh. Credenciales: rol de la instancia (IMDSv2).
set -euo pipefail
umask 027

ETC="${AGROTECH_ETC:-/etc/agrotech}"   # se puede cambiar solo para probar el script
GRUPO="${AGROTECH_GRUPO:-agrotech}"
# shellcheck source=/dev/null
source "$ETC/infra.env"
SALIDA="$ETC/api.env"
TEMPORAL="$(mktemp "$ETC/.api.env.XXXXXX")"
trap 'rm -f "$TEMPORAL"' EXIT

linea() { # NOMBRE VALOR → NOMBRE='VALOR' (válido para systemd y para bash)
  if [[ "$2" == *"'"* || "$2" == *$'\n'* ]]; then
    echo "El valor de $1 no puede tener comillas simples ni saltos de línea." >&2
    exit 1
  fi
  printf "%s='%s'\n" "$1" "$2" >> "$TEMPORAL"
}

# 1) Valores fijos de producción y los que dejó la plantilla de CloudFormation.
linea NODE_ENV production
linea PORT 3000
linea AWS_REGION "$AWS_REGION"
linea FOTOS_DRIVER s3
linea FOTOS_S3_BUCKET "$FOTOS_S3_BUCKET"
linea WOMPI_AMBIENTE "$([[ "$ENTORNO" == produccion ]] && echo prod || echo test)"

# 2) Base de datos: TLS verificado contra la CA de RDS (rds.force_ssl=1 en el grupo de parámetros).
SECRETO="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$SECRETO_RDS" --query SecretString --output text)"
USUARIO="$(jq -r '.username | @uri' <<<"$SECRETO")"
CLAVE="$(jq -r '.password | @uri' <<<"$SECRETO")"
linea DATABASE_URL "postgres://${USUARIO}:${CLAVE}@${DB_HOST}:${DB_PUERTO}/${DB_NOMBRE}?sslmode=verify-full&sslrootcert=${ETC}/rds-ca.pem"

# 3) Parámetros de la aplicación en SSM: JWT_SECRETO, WOMPI_*, FOTOS_URL_BASE, HORAS_CANCELACION…
#    FCM_CREDENCIALES_JSON (el JSON de la cuenta de servicio) se escribe en un archivo aparte.
PARAMETROS="$(aws ssm get-parameters-by-path --region "$AWS_REGION" --path "/agrotech/${ENTORNO}/" \
  --with-decryption --recursive --query 'Parameters[].{n:Name,v:Value}' --output json)"
while IFS=$'\t' read -r nombre valor_b64; do
  clave="${nombre##*/}"
  valor="$(base64 -d <<<"$valor_b64")"
  case "$clave" in
    rds) ;; # el secreto de RDS vive en Secrets Manager con el mismo prefijo
    FCM_CREDENCIALES_JSON)
      install -m 640 -o root -g "$GRUPO" /dev/null "$ETC/fcm.json"
      printf '%s' "$valor" > "$ETC/fcm.json"
      linea FCM_CREDENCIALES "$ETC/fcm.json" ;;
    [A-Z]*) linea "$clave" "$valor" ;;
    *) echo "Parámetro ignorado: $nombre" >&2 ;;
  esac
done < <(jq -r '.[] | [.n, (.v | @base64)] | @tsv' <<<"$PARAMETROS")

grep -q '^JWT_SECRETO=' "$TEMPORAL" || { echo "Falta /agrotech/${ENTORNO}/JWT_SECRETO en SSM." >&2; exit 1; }

chown "root:$GRUPO" "$TEMPORAL"
chmod 640 "$TEMPORAL"
mv -f "$TEMPORAL" "$SALIDA"
trap - EXIT
echo "[cargar-entorno] $SALIDA actualizado ($(grep -c '=' "$SALIDA") variables)."
