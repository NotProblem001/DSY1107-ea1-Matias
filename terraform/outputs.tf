# Estos valores son la configuración que necesita el front. En vez de copiarlos
# a mano desde la consola de AWS, Terraform los entrega ya armados.

output "cognito_domain" {
  description = "Base del Hosted UI / servidor de autorización"
  value       = "https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.us-east-1.amazoncognito.com"
}

output "cognito_client_id" {
  description = "client_id del cliente publico (SPA)"
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.pool.id
}

output "api_endpoint" {
  description = "Base de la API HTTP (stage $default)"
  value       = aws_apigatewayv2_api.api_manager.api_endpoint
}

# Atajo: `terraform output -raw frontend_env > frontend/.env`
output "frontend_env" {
  description = "Contenido listo para pegar en frontend/.env"
  value       = <<-ENVFILE
    VITE_COGNITO_DOMAIN=https://${aws_cognito_user_pool_domain.hosted_ui.domain}.auth.us-east-1.amazoncognito.com
    VITE_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.spa.id}
    VITE_REDIRECT_URI=http://localhost:5173/
    VITE_API_BASE=${aws_apigatewayv2_api.api_manager.api_endpoint}
  ENVFILE
}
