#!/usr/bin/env bash
# Ejecuta terraform dentro de un contenedor (evita proxies TLS locales que rompen el handshake de los providers).
# Uso: ./terraform-rabbitmq/tf.sh plan -var=ip_permitida=1.2.3.4/32
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
MSYS_NO_PATHCONV=1 docker run --rm -i \
  -v "$raiz:/work" -v "$HOME/.aws:/root/.aws:ro" \
  -e AWS_PROFILE -e AWS_REGION -w /work/terraform-rabbitmq \
  hashicorp/terraform:1.9.8 "$@"
