#!/usr/bin/env bash
#
# Publica una versión nueva del backend Pedidos360 en ECS (Elastic Container Service).
#
# El servicio corre con tipo de lanzamiento Fargate (linux/amd64).
# Terraform crea la infraestructura base (cluster, servicio, seguridad) y este script
# empaqueta el artefacto, sube la imagen Docker a ECR, actualiza la tarea de ECS
# y reapunta dinámicamente las integraciones de API Gateway hacia la nueva IP de la tarea.
#
# Uso:
#   ./scripts/publicar-ecs.sh
#

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF="terraform -chdir=${RAIZ}/terraform"

# ---------------------------------------------------------------------------
# Resolución dinámica de variables (entorno manda; Terraform es respaldo)
# ---------------------------------------------------------------------------
leer() {
  local desde_entorno="${!1:-}"
  if [ -n "$desde_entorno" ]; then
    echo "$desde_entorno"
  elif command -v terraform >/dev/null 2>&1 && $TF output -raw "$2" >/dev/null 2>&1; then
    $TF output -raw "$2"
  else
    echo "Falta \$$1 y no hay salida '$2' en Terraform." >&2
    return 1
  fi
}

echo "==> Leyendo la configuración de Pedidos360"
REPO="$(leer ECR_REPO ecs_repositorio)"
CLUSTER="$(leer ECS_CLUSTER ecs_cluster)"
SERVICIO="$(leer ECS_SERVICE ecs_servicio)"
API_ID="$(leer API_ID api_id)"
INTEGRACION_PUB="$(leer INTEGRATION_PUBLICO_DATOS_ID integracion_publico_datos_id)"
INTEGRACION_DAT="$(leer INTEGRATION_DATOS_ID integracion_datos_id)"
INTEGRACION_PED_COL="$(leer INTEGRATION_PEDIDOS_COL_ID integracion_pedidos_col_id)"
INTEGRACION_PED_ELE="$(leer INTEGRATION_PEDIDOS_ELE_ID integracion_pedidos_ele_id)"

VERSION="v$(date +%Y%m%d-%H%M%S)"

echo "==> 1/5 Construyendo el JAR con Maven Wrapper (Java 21)"
( cd "${RAIZ}/backend" && ./mvnw --batch-mode --no-transfer-progress clean package -DskipTests )

echo "==> 2/5 Construyendo la imagen Docker (${VERSION}, linux/amd64)"
docker build --platform linux/amd64 \
  -t "${REPO}:${VERSION}" -t "${REPO}:latest" "${RAIZ}/backend"

echo "==> 3/5 Autenticando contra ECR"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${REPO%%/*}"

echo "==> 4/5 Subiendo la imagen a ECR"
docker push "${REPO}:${VERSION}"
docker push "${REPO}:latest"

echo "==> 5/5 Registrando la revisión y actualizando ECS Fargate"

command -v jq >/dev/null || { echo "Falta jq." >&2; exit 1; }

TAREA_JSON="$(aws ecs describe-task-definition --region "$REGION" \
  --task-definition "$SERVICIO" --query taskDefinition --output json \
  | jq --arg imagen "${REPO}:${VERSION}" '
      .containerDefinitions = (.containerDefinitions
        | map(if .name == "backend" then .image = $imagen else . end))
      | del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
            .compatibilities, .registeredAt, .registeredBy, .deregisteredAt)')"

REVISION="$(aws ecs register-task-definition --region "$REGION" \
  --cli-input-json "$TAREA_JSON" \
  --query "taskDefinition.taskDefinitionArn" --output text)"

echo "    Nueva revisión registrada: ${REVISION##*/}"

aws ecs update-service --region "$REGION" \
  --cluster "$CLUSTER" --service "$SERVICIO" \
  --task-definition "$REVISION" >/dev/null

echo "    Esperando a que el despliegue termine y estabilice..."
INTENTOS=60
for INTENTO in $(seq 1 $INTENTOS); do
  if ! LEIDO="$(aws ecs describe-services --region "$REGION" \
    --cluster "$CLUSTER" --services "$SERVICIO" \
    --query "services[0].[deployments[0].rolloutState,runningCount,desiredCount]" \
    --output text 2>&1)"; then
    if echo "$LEIDO" | grep -q "explicit deny"; then
      echo >&2
      echo "Se cerró la sesión del Learner Lab en mitad del despliegue." >&2
      echo "Reabre el lab, actualiza las credenciales y vuelve a ejecutar." >&2
      exit 1
    fi
    echo "No se pudo consultar el servicio: $LEIDO" >&2
    exit 1
  fi
  ESTADO="$(echo "$LEIDO" | awk '{print $1}')"
  CORRIENDO="$(echo "$LEIDO" | awk '{print $2}')"
  DESEADAS="$(echo "$LEIDO" | awk '{print $3}')"
  echo "    Estado: ${ESTADO} | Instancias: ${CORRIENDO}/${DESEADAS}"

  if [ "$ESTADO" = "COMPLETED" ] && [ "$CORRIENDO" = "$DESEADAS" ]; then
    break
  fi
  if [ "$ESTADO" = "FAILED" ]; then
    echo "FALLÓ el despliegue. Logs del contenedor:" >&2
    echo "    aws logs tail /ecs/${SERVICIO} --follow" >&2
    exit 1
  fi
  if [ "$INTENTO" -eq "$INTENTOS" ]; then
    echo "Se agotó la espera. Revisa: aws logs tail /ecs/${SERVICIO} --follow" >&2
    exit 1
  fi
  sleep 10
done

# ---------------------------------------------------------------------------
# Reapuntar el API Gateway a la IP de la nueva tarea Fargate
# ---------------------------------------------------------------------------
echo "==> Reapuntando API Gateway a la tarea Fargate activa"

TAREA="$(aws ecs list-tasks --region "$REGION" \
  --cluster "$CLUSTER" --service-name "$SERVICIO" --desired-status RUNNING \
  --query "taskArns[0]" --output text)"

ENI="$(aws ecs describe-tasks --region "$REGION" \
  --cluster "$CLUSTER" --tasks "$TAREA" \
  --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" \
  --output text)"

IP="$(aws ec2 describe-network-interfaces --region "$REGION" \
  --network-interface-ids "$ENI" \
  --query "NetworkInterfaces[0].Association.PublicIp" --output text)"

if [ -z "$IP" ] || [ "$IP" = "None" ]; then
  echo "No se pudo resolver la IP pública de la tarea ($TAREA)." >&2
  exit 1
fi

reapuntar() {  # $1 = id de la integración, $2 = ruta en el backend
  aws apigatewayv2 update-integration --region "$REGION" \
    --api-id "$API_ID" \
    --integration-id "$1" \
    --integration-uri "http://${IP}:8080$2" >/dev/null
}

reapuntar "$INTEGRACION_PUB"     "/publico/datos"
reapuntar "$INTEGRACION_DAT"     "/datos"
reapuntar "$INTEGRACION_PED_COL" "/pedidos"
reapuntar "$INTEGRACION_PED_ELE" "/pedidos/{proxy}"

echo ""
echo "OK  Versión ${VERSION} desplegada exitosamente."
echo "    Backend Fargate : http://${IP}:8080/actuator/health"
echo "    Público Datos   : http://${IP}:8080/publico/datos"
echo "    Pedidos         : http://${IP}:8080/pedidos"
if URL_API="$($TF output -raw url_pedidos_protegido 2>/dev/null)"; then
  echo "    API Gateway URL : ${URL_API} (requiere JWT y scope pedidos/read)"
fi
echo ""
