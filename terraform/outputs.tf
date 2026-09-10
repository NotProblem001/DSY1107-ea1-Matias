# --- Outputs para Frontend y Auth ---
output "cognito_domain" {
  description = "Base del Hosted UI / servidor de autorización"
  value       = "https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_client_id" {
  description = "client_id del cliente publico (SPA)"
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_user_pool_id" {
  description = "ID del User Pool de Cognito"
  value       = aws_cognito_user_pool.pool.id
}

output "amplify_app_id" {
  description = "ID de la aplicacion en AWS Amplify"
  value       = aws_amplify_app.front.id
}

output "amplify_url" {
  description = "URL publica asignada por Amplify"
  value       = local.url_amplify
}

output "api_endpoint" {
  description = "URL base de API Gateway (stage $default)"
  value       = aws_apigatewayv2_api.api_manager.api_endpoint
}

output "url_datos_protegido" {
  description = "Endpoint de /datos con autorizador JWT"
  value       = "${aws_apigatewayv2_api.api_manager.api_endpoint}/datos"
}

output "url_productos_protegido" {
  description = "Endpoint de /productos con Scope Guard"
  value       = "${aws_apigatewayv2_api.api_manager.api_endpoint}/productos"
}

# --- Outputs para Automatización y Pipelines (publicar-ecs.sh / backend_deploy.yml) ---
output "api_id" {
  description = "ID de la API en API Gateway"
  value       = aws_apigatewayv2_api.api_manager.id
}

output "integracion_id" {
  description = "ID de la integración HTTP de /datos"
  value       = aws_apigatewayv2_integration.backend_datos.id
}

output "integracion_productos_coleccion_id" {
  description = "ID de la integración HTTP de colección /productos"
  value       = aws_apigatewayv2_integration.backend_productos_col.id
}

output "integracion_productos_elemento_id" {
  description = "ID de la integración HTTP de elemento /productos/{proxy}"
  value       = aws_apigatewayv2_integration.backend_productos_ele.id
}

output "ecs_repositorio" {
  description = "URI del repositorio ECR para backend"
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

output "lambda_user_token_ms" {
  description = "Nombre de la funcion Lambda Pre-Token V2"
  value       = aws_lambda_function.user_token_ms.function_name
}

# Archivo .env listo para desarrollo local: `terraform output -raw frontend_env > frontend/.env`
output "frontend_env" {
  description = "Contenido listo para pegar en frontend/.env"
  value       = <<-ENVFILE
    VITE_COGNITO_DOMAIN=https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.${var.aws_region}.amazoncognito.com
    VITE_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.spa.id}
    VITE_REDIRECT_URI=http://localhost:5173/
    VITE_API_BASE=${aws_apigatewayv2_api.api_manager.api_endpoint}
  ENVFILE
}
