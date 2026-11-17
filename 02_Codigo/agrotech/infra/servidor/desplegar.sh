#!/usr/bin/env bash
# AGRO-16 · Despliegue de una versión en el servidor EC2 (lo ejecuta GitHub Actions por SSM Run Command, como root).
#   desplegar.sh <version>          p. ej. v1.0.0 o el SHA del commit
# Pasos: descargar → instalar dependencias → cargar entorno → migrar → activar → verificar /salud → (si falla) revertir.
# Las migraciones son aditivas (columnas y tablas nuevas), así que la versión anterior sigue funcionando si se revierte.
set -euo pipefail

VERSION="${1:?Uso: desplegar.sh <version>}"
[[ "$VERSION" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Versión inválida: $VERSION" >&2; exit 1; }
# shellcheck source=/dev/null
source /etc/agrotech/infra.env

RAIZ=/srv/agrotech   # root:agrotech; el usuario del servicio solo puede leer
DESTINO="$RAIZ/versiones/$VERSION"
ACTUAL="$RAIZ/actual"
PAQUETE="$(mktemp --suffix=.tar.gz)"
trap 'rm -f "$PAQUETE"' EXIT
log() { echo "[desplegar $(date -u +%H:%M:%S)] $*"; }

log "Descargando versión $VERSION"
aws s3 cp --only-show-errors "s3://${BUCKET_DESPLIEGUES}/versiones/${VERSION}.tar.gz" "$PAQUETE"
rm -rf "$DESTINO"
install -d -o root -g agrotech -m 750 "$DESTINO"
tar -xzf "$PAQUETE" -C "$DESTINO" --no-same-owner
chmod 750 "$DESTINO/infra/servidor/"*.sh

log "Instalando dependencias de producción"
chown -R agrotech:agrotech "$DESTINO/api"   # solo durante npm ci (los paquetes no corren como root)
runuser -u agrotech -- bash -c "cd '$DESTINO/api' && npm ci --omit=dev --no-audit --no-fund --loglevel=error --cache /tmp/npm-agrotech"
# El código queda de root: el usuario del servicio no puede modificar lo que systemd ejecuta (ExecStartPre=+ corre como root).
chown -R root:agrotech "$DESTINO"
chmod -R g-w,o-rwx "$DESTINO"

log "Cargando configuración (SSM + Secrets Manager)"
"$DESTINO/infra/servidor/cargar-entorno.sh"

log "Aplicando migraciones pendientes"
runuser -u agrotech -- bash -c "set -a; source /etc/agrotech/api.env; set +a; cd '$DESTINO/api' && node src/db/migrate.js"

ANTERIOR="$(readlink -f "$ACTUAL" 2>/dev/null || true)"
activar() {
  ln -sfn "$1" "$ACTUAL.nuevo"
  mv -Tf "$ACTUAL.nuevo" "$ACTUAL"
  install -m 644 "$1/infra/servidor/agrotech-api.service" /etc/systemd/system/agrotech-api.service
  systemctl daemon-reload
  systemctl enable --quiet agrotech-api
  systemctl restart agrotech-api
}
sano() {
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 http://127.0.0.1:3000/api/v1/salud >/dev/null; then return 0; fi
    sleep 2
  done
  return 1
}

log "Activando $VERSION (anterior: ${ANTERIOR:-ninguna})"
activar "$DESTINO"
if sano; then
  log "OK: $(curl -fsS http://127.0.0.1:3000/api/v1/salud)"
else
  log "La versión $VERSION no respondió /salud en 60 s"
  journalctl -u agrotech-api -n 40 --no-pager || true
  if [[ -n "$ANTERIOR" && -d "$ANTERIOR" && "$ANTERIOR" != "$DESTINO" ]]; then
    log "Revirtiendo a $(basename "$ANTERIOR")"
    activar "$ANTERIOR"
    if sano; then log "Reversión completada"; else log "ATENCIÓN: la versión anterior tampoco responde"; fi
  fi
  exit 1
fi

# Conserva las 5 versiones más recientes (para revertir rápido).
find "$RAIZ/versiones" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2- |
  while read -r viejo; do
    if [[ "$viejo" != "$(readlink -f "$ACTUAL")" ]]; then rm -rf "$viejo"; fi
  done
log "Despliegue de $VERSION terminado"
