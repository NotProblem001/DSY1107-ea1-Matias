#!/usr/bin/env bash
# Despliegue Unidad 3 en AWS: ECR -> build/push de pedidos-streaming-ms -> EC2 con docker compose + API Gateway.
#   ./terraform-kafka/desplegar.sh            # apply
#   ./terraform-kafka/desplegar.sh destroy    # destruye todo
set -euo pipefail
cd "$(dirname "$0")"
TF=./tf.sh
TAG=${TAG:-v1}
IP=${IP_PERMITIDA:-$(curl -s https://checkip.amazonaws.com)/32}

aws_cli() { MSYS_NO_PATHCONV=1 docker run --rm -i -v "$HOME/.aws:/root/.aws:ro" -e AWS_PROFILE -e AWS_REGION amazon/aws-cli:2.17.0 "$@"; }

# Cognito y Amplify viven en terraform/ (EA1): se leen en vivo para el authorizer JWT y el CORS del API.
POOL=${COGNITO_USER_POOL_ID:-$(aws_cli cognito-idp list-user-pools --max-results 60 --query "UserPools[?Name=='dsy1107-matias-araos'].Id | [0]" --output text | tr -d '\r')}
CLIENTE=${COGNITO_CLIENT_ID:-$(aws_cli cognito-idp list-user-pool-clients --user-pool-id "$POOL" --query "UserPoolClients[?ClientName=='spa-react'].ClientId | [0]" --output text | tr -d '\r')}
AMPLIFY=${AMPLIFY_ORIGEN:-https://main.$(aws_cli amplify list-apps --query "apps[0].defaultDomain" --output text | tr -d '\r')}
VARS=(-input=false -no-color -var="ip_permitida=$IP" -var="tag_imagen=$TAG"
  -var="cognito_user_pool_id=$POOL" -var="cognito_client_id=$CLIENTE"
  -var="origenes_cors=[\"$AMPLIFY\",\"http://localhost:5173\"]")

if [ "${1:-}" = destroy ]; then
  $TF destroy -auto-approve "${VARS[@]}"
  exit
fi

$TF init -input=false -no-color >/dev/null
$TF apply -auto-approve "${VARS[@]}" -target=aws_ecr_repository.streaming

url=$($TF output -raw ecr_repositorio | tr -d '\r')
registro=${url%%/*}

aws_cli ecr get-login-password --region "${AWS_REGION:-us-east-1}" | docker login --username AWS --password-stdin "$registro"
docker build -t "$url:$TAG" ../streaming/pedidos-streaming-ms
docker push -q "$url:$TAG"

$TF apply -auto-approve "${VARS[@]}"
$TF output -no-color
