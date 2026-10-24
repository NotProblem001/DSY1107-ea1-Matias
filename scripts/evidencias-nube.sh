#!/usr/bin/env bash
# Reune evidencias de la EA1 desplegada (API Gateway, Cognito, ECS, RDS, Amplify) para el informe.
# Uso: ./scripts/toolbox.sh ./scripts/evidencias-nube.sh > docs/evidencias/ea1-nube-<fecha>.txt
# No imprime secretos: los JWT se truncan y las variables de la tarea ECS no se muestran.
set -uo pipefail
TF="terraform -chdir=terraform output -raw"
API_ID=$($TF api_id); API=$($TF url_publico_datos); API=${API%/publico/datos}
POOL=$($TF cognito_user_pool_id); CLIENT=$(terraform -chdir=terraform output -json | jq -r '.env_frontend.value' | sed -n 's/^VITE_COGNITO_CLIENT_ID=//p')
APP=$($TF amplify_app_id); WEB=$($TF amplify_url); CLUSTER=$($TF ecs_cluster); SVC=$($TF ecs_servicio)
s() { echo; echo "================ $* ================"; }
codigo() { curl -s -o /tmp/cuerpo -w "%{http_code}" "$@"; }
token() { aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id "$CLIENT" \
  --auth-parameters "USERNAME=$1,PASSWORD=Pedidos360!" --query AuthenticationResult.$2 --output text; }
claims() { cut -d. -f2 <<< "$1" | tr '_-' '/+' | awk '{while (length($0)%4) $0=$0"="; print}' | base64 -d; }

echo "Evidencias EA1 Pedidos360 - $(date -u +%FT%TZ) - $(aws sts get-caller-identity --query Arn --output text)"

s "1. API Manager (API Gateway HTTP) en funcionamiento"
aws apigatewayv2 get-api --api-id "$API_ID" --query '{Nombre:Name,Id:ApiId,Protocolo:ProtocolType,Endpoint:ApiEndpoint,Creada:CreatedDate,CORS:CorsConfiguration}' --output json
aws apigatewayv2 get-stages --api-id "$API_ID" --query 'Items[].{Stage:StageName,AutoDeploy:AutoDeploy,Actualizado:LastUpdatedDate}' --output table

s "2. Configuracion del API Manager hacia el backend (rutas, autorizador, integraciones)"
aws apigatewayv2 get-routes --api-id "$API_ID" --query 'Items[].{Ruta:RouteKey,Auth:AuthorizationType,Scopes:join(`,`,AuthorizationScopes||`[]`),Destino:Target}' --output table
aws apigatewayv2 get-authorizers --api-id "$API_ID" --query 'Items[].{Nombre:Name,Tipo:AuthorizerType,Issuer:JwtConfiguration.Issuer,Audiencia:JwtConfiguration.Audience,Fuente:IdentitySource}' --output json
aws apigatewayv2 get-integrations --api-id "$API_ID" --query 'Items[].{Id:IntegrationId,Tipo:IntegrationType,Metodo:IntegrationMethod,URI:IntegrationUri}' --output table

s "3. El API Manager valida JWT (rechaza invalidos, acepta validos, aplica scopes)"
echo "GET /publico/datos sin token          -> $(codigo "$API/publico/datos")"
echo "GET /pedidos sin token                -> $(codigo "$API/pedidos") $(cat /tmp/cuerpo)"
echo "GET /pedidos token malformado         -> $(codigo -H 'Authorization: Bearer abc.def.ghi' "$API/pedidos") $(cat /tmp/cuerpo)"
T=$(token admin@pedidos360.com AccessToken)
FIRMA_ALTERADA="${T%?????}XXXXX"
echo "GET /pedidos firma alterada           -> $(codigo -H "Authorization: Bearer $FIRMA_ALTERADA" "$API/pedidos") $(cat /tmp/cuerpo)"
for u in lector cliente editor admin; do
  T=$(token $u@pedidos360.com AccessToken)
  echo "--- $u@pedidos360.com  token=${T:0:25}...  scope: $(claims "$T" | jq -r .scope)  grupos: $(claims "$T" | jq -r '."cognito:groups"|join(",")')"
  echo "    GET  /pedidos -> $(codigo -H "Authorization: Bearer $T" "$API/pedidos")"
  echo "    GET  /datos   -> $(codigo -H "Authorization: Bearer $T" "$API/datos")"
  echo "    POST /pedidos -> $(codigo -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
    -d "{\"clienteEmail\":\"$u@pedidos360.com\",\"descripcion\":\"Evidencia informe $u\",\"monto\":15990,\"estado\":\"PENDIENTE\"}" "$API/pedidos") $(head -c 140 /tmp/cuerpo)"
done

s "4. Tenant IDaaS (Cognito User Pool), cliente OAuth y usuarios registrados"
aws cognito-idp describe-user-pool --user-pool-id "$POOL" --query 'UserPool.{Nombre:Name,Id:Id,Dominio:Domain,Creado:CreationDate,Usuarios:EstimatedNumberOfUsers,MFA:MfaConfiguration}' --output json
aws cognito-idp describe-user-pool-client --user-pool-id "$POOL" --client-id "$CLIENT" --query 'UserPoolClient.{Cliente:ClientName,Flujos:AllowedOAuthFlows,Scopes:AllowedOAuthScopes,Callbacks:CallbackURLs,IdPs:SupportedIdentityProviders}' --output json
aws cognito-idp list-resource-servers --user-pool-id "$POOL" --max-results 10 --query 'ResourceServers[].{Id:Identifier,Scopes:Scopes[].ScopeName}' --output json
aws cognito-idp list-users --user-pool-id "$POOL" --query 'Users[].{Usuario:Username,Estado:UserStatus,Activo:Enabled,Creado:UserCreateDate}' --output table
for g in $(aws cognito-idp list-groups --user-pool-id "$POOL" --query 'Groups[].GroupName' --output text); do
  echo "Grupo $g: $(aws cognito-idp list-users-in-group --user-pool-id "$POOL" --group-name "$g" --query 'Users[].Username' --output text)"
done

s "5. OpenID Connect: discovery del tenant e ID token emitido"
curl -s "https://cognito-idp.us-east-1.amazonaws.com/$POOL/.well-known/openid-configuration" | jq '{issuer,authorization_endpoint,token_endpoint,jwks_uri,response_types_supported,code_challenge_methods_supported}'
claims "$(token cliente@pedidos360.com IdToken)" | jq '{iss,aud,token_use,email,"cognito:groups",exp}'

s "6. Backend desplegado (ECS Fargate) y base de datos cloud (RDS PostgreSQL)"
aws ecs describe-services --cluster "$CLUSTER" --services "$SVC" --query 'services[0].{Servicio:serviceName,Estado:status,Lanzamiento:launchType,Deseadas:desiredCount,Corriendo:runningCount,Tarea:taskDefinition}' --output json
aws ecs describe-task-definition --task-definition "$SVC" --query 'taskDefinition.containerDefinitions[0].{Imagen:image,Puerto:portMappings[0].containerPort,VariablesDeEntorno:environment[].name}' --output json
aws rds describe-db-instances --query 'DBInstances[].{Id:DBInstanceIdentifier,Motor:Engine,Version:EngineVersion,Clase:DBInstanceClass,Estado:DBInstanceStatus,BD:DBName,Endpoint:Endpoint.Address,Publica:PubliclyAccessible,Cifrada:StorageEncrypted}' --output json
echo "Conexion del backend a PostgreSQL (logs CloudWatch):"
aws logs tail "/ecs/$SVC" --since 3h 2>/dev/null | grep -m2 -E "PgConnection|PostgreSQL"

s "7. Frontend desplegado (Amplify) e integrado con Cognito y API Gateway"
aws amplify get-app --app-id "$APP" --query 'app.{Nombre:name,Dominio:defaultDomain,Plataforma:platform}' --output json
aws amplify list-jobs --app-id "$APP" --branch-name main --max-items 3 --query 'jobSummaries[].{Job:jobId,Estado:status,Tipo:jobType,Fin:endTime}' --output table
echo "GET $WEB/ -> $(codigo "$WEB/") ($(grep -o '<title>[^<]*' /tmp/cuerpo | sed 's/<title>//'))"
echo "GET $WEB/config.json -> $(codigo "$WEB/config.json")"; cat /tmp/cuerpo; echo
echo "CORS preflight desde el frontend hacia API Gateway:"
curl -s -o /dev/null -D - -X OPTIONS -H "Origin: ${WEB}" -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization' "$API/pedidos" | grep -i -E '^HTTP|access-control'
