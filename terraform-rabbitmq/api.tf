# API HTTPS para el frontend (Amplify): JWT de Cognito en el perimetro y header secreto hacia la EC2.
# Mismo archivo en terraform-rabbitmq/ y terraform-kafka/; cada stack define local.nombre_api,
# local.ip_backend, local.rutas ("METODO /ruta" => "puerto/ruta-backend") y random_password.origen.

resource "aws_apigatewayv2_api" "mensajeria" {
  name          = local.nombre_api
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.origenes_cors
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.mensajeria.id
  name             = "cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

resource "aws_apigatewayv2_integration" "ruta" {
  for_each           = local.rutas
  api_id             = aws_apigatewayv2_api.mensajeria.id
  integration_type   = "HTTP_PROXY"
  integration_method = split(" ", each.key)[0]
  integration_uri    = "http://${local.ip_backend}:${each.value}"

  request_parameters = {
    "append:header.x-origen-secreto" = random_password.origen.result
  }
}

resource "aws_apigatewayv2_route" "ruta" {
  for_each           = local.rutas
  api_id             = aws_apigatewayv2_api.mensajeria.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.ruta[each.key].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.mensajeria.id
  name        = "$default"
  auto_deploy = true
}

output "api_url" {
  description = "Base HTTPS para config.json del frontend"
  value       = aws_apigatewayv2_api.mensajeria.api_endpoint
}
