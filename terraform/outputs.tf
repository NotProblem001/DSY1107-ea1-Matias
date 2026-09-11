# --- Hosting y Frontend (AWS Amplify y Cognito) ---
output "amplify_app_id" {
  description = "ID de la aplicación en AWS Amplify"
  value       = aws_amplify_app.front.id
}

output "amplify_url" {
  description = "URL pública de AWS Amplify"
  value       = local.url_amplify
}

output "cognito_domain" {
  description = "Base del Hosted UI / servidor de autorización de Cognito"
  value       = "https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "cognito_client_id" {
  description = "Client ID del cliente público (SPA)"
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_user_pool_id" {
  description = "ID del User Pool de Cognito"
  value       = aws_cognito_user_pool.pool.id
}

output "api_endpoint" {
  description = "URL base de API Gateway (stage $default)"
  value       = aws_apigatewayv2_api.api_manager.api_endpoint
}

output "url_publico_datos" {
  description = "Endpoint público de contraste de Pedidos360"
  value       = "${aws_apigatewayv2_api.api_manager.api_endpoint}/publico/datos"
}

output "url_pedidos_protegido" {
  description = "Endpoint protegido de pedidos con Scope Guard"
  value       = "${aws_apigatewayv2_api.api_manager.api_endpoint}/pedidos"
}

output "url_datos_protegido" {
  description = "Endpoint protegido de datos con Scope Guard"
  value       = "${aws_apigatewayv2_api.api_manager.api_endpoint}/datos"
}

# --- Backend y Cómputo (ECS Fargate / ECR) ---
output "ecs_repositorio" {
  description = "URI del repositorio ECR"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster" {
  description = "Nombre del cluster ECS"
  value       = aws_ecs_cluster.backend.name
}

output "ecs_servicio" {
  description = "Nombre del servicio ECS Fargate"
  value       = aws_ecs_service.backend.name
}

# --- Identificadores para Scripts y Pipelines (publicar-ecs.sh / backend_deploy.yml) ---
output "api_id" {
  description = "ID de la API en API Gateway"
  value       = aws_apigatewayv2_api.api_manager.id
}

output "integracion_publico_datos_id" {
  description = "ID de la integración HTTP de /publico/datos"
  value       = aws_apigatewayv2_integration.backend_publico_datos.id
}

output "integracion_datos_id" {
  description = "ID de la integración HTTP de /datos"
  value       = aws_apigatewayv2_integration.backend_datos.id
}

output "integracion_pedidos_col_id" {
  description = "ID de la integración HTTP de colección /pedidos"
  value       = aws_apigatewayv2_integration.backend_pedidos_col.id
}

output "integracion_pedidos_ele_id" {
  description = "ID de la integración HTTP de elemento /pedidos/{proxy}"
  value       = aws_apigatewayv2_integration.backend_pedidos_ele.id
}

# Alias de retrocompatibilidad
output "integracion_id" {
  description = "Alias retrocompatible de integración"
  value       = aws_apigatewayv2_integration.backend_publico_datos.id
}

output "integracion_solicitudes_coleccion_id" {
  description = "Alias retrocompatible"
  value       = aws_apigatewayv2_integration.backend_pedidos_col.id
}

output "integracion_solicitudes_elemento_id" {
  description = "Alias retrocompatible"
  value       = aws_apigatewayv2_integration.backend_pedidos_ele.id
}

output "lambda_user_token_ms" {
  description = "Nombre de la función Lambda Pre-Token V2"
  value       = aws_lambda_function.user_token_ms.function_name
}

# Variables de entorno listas para desarrollo local (env_frontend y alias frontend_env)
output "env_frontend" {
  description = "Contenido listo para pegar en frontend/.env"
  value       = <<-ENVFILE
    VITE_COGNITO_DOMAIN=https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${data.aws_region.current.name}.amazoncognito.com
    VITE_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.spa.id}
    VITE_REDIRECT_URI=http://localhost:5173/
    VITE_API_BASE=${aws_apigatewayv2_api.api_manager.api_endpoint}
  ENVFILE
}

output "frontend_env" {
  description = "Alias retrocompatible de variables de entorno para frontend"
  value       = <<-ENVFILE
    VITE_COGNITO_DOMAIN=https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${data.aws_region.current.name}.amazoncognito.com
    VITE_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.spa.id}
    VITE_REDIRECT_URI=http://localhost:5173/
    VITE_API_BASE=${aws_apigatewayv2_api.api_manager.api_endpoint}
  ENVFILE
}
