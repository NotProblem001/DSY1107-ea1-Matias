# Herramientas de despliegue de la EA1 en un contenedor Linux: terraform, aws-cli, jq, zip, docker CLI y Java 21.
# Lo usa scripts/toolbox.sh para no depender de lo instalado (ni de proxies TLS) en el equipo local.
FROM hashicorp/terraform:1.9.8
RUN apk upgrade --no-cache && apk add --no-cache bash aws-cli jq zip curl docker-cli openjdk21-jdk
ENTRYPOINT []
