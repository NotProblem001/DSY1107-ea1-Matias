#!/usr/bin/env bash
# Ejecuta un comando dentro del contenedor de herramientas (toolbox.Dockerfile) con el repo en /work,
# las credenciales de ~/.aws (solo lectura) y el socket de Docker para construir y subir imagenes.
#   ./scripts/toolbox.sh terraform -chdir=terraform apply
#   ./scripts/toolbox.sh ./scripts/publicar-ecs.sh
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
docker build -q -t pedidos360-toolbox -f "$raiz/scripts/toolbox.Dockerfile" "$raiz/scripts" >/dev/null
MSYS_NO_PATHCONV=1 docker run --rm -i \
  -v "$raiz:/work" -v "$HOME/.aws:/root/.aws:ro" -v /var/run/docker.sock:/var/run/docker.sock \
  -e AWS_PROFILE -e AWS_REGION=${AWS_REGION:-us-east-1} -w /work \
  pedidos360-toolbox "$@"
