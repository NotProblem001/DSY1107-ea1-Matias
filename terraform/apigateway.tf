# API Manager: HTTP API Gateway con JWT Authorizer y Scope Guard
resource "aws_apigatewayv2_api" "api_manager" {
  name          = "api-manager-${lower(var.estudiante)}"
  protocol_type = "HTTP"

  # CORS configurado SIN barra final en los orígenes permitidos
  cors_configuration {
    allow_origins = [
      "http://localhost:5173",
      local.url_amplify
    ]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 300
  }
}

# Autorizador JWT contra Amazon Cognito
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api_manager.id
  name             = "cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.spa.id]
    issuer   = "https://${aws_cognito_user_pool.pool.endpoint}"
  }
}

# Integraciones HTTP Proxy hacia el Backend en ECS Fargate
# ignore_changes en integration_uri es indispensable: la IP de la task Fargate
# cambia en cada despliegue y los scripts (publicar-ecs.sh / backend_deploy.yml)
# la actualizan dinámicamente sin pisar la infraestructura de Terraform.
resource "aws_apigatewayv2_integration" "backend_datos" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "GET"
  integration_uri        = "http://127.0.0.1:8080/datos"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

resource "aws_apigatewayv2_integration" "backend_productos_col" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://127.0.0.1:8080/productos"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

resource "aws_apigatewayv2_integration" "backend_productos_ele" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://127.0.0.1:8080/productos/{proxy}"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

resource "aws_apigatewayv2_integration" "backend_publico" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "GET"
  integration_uri        = "http://127.0.0.1:8080/publico/datos"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# --- Rutas Protegidas y Públicas ---

# 1. Ruta pública sin autorizador (para contraste)
resource "aws_apigatewayv2_route" "publico" {
  api_id    = aws_apigatewayv2_api.api_manager.id
  route_key = "GET /publico/datos"
  target    = "integrations/${aws_apigatewayv2_integration.backend_publico.id}"
}

# 2. Ruta protegida con scope base openid
resource "aws_apigatewayv2_route" "datos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /datos"
  target               = "integrations/${aws_apigatewayv2_integration.backend_datos.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["openid"]
}

# 3. Rutas de Lectura de Productos (requiere productos/read)
resource "aws_apigatewayv2_route" "get_productos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /productos"
  target               = "integrations/${aws_apigatewayv2_integration.backend_productos_col.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["productos/read"]
}

resource "aws_apigatewayv2_route" "get_productos_id" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /productos/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_productos_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["productos/read"]
}

# 4. Rutas de Escritura de Productos (requiere productos/write)
resource "aws_apigatewayv2_route" "post_productos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "POST /productos"
  target               = "integrations/${aws_apigatewayv2_integration.backend_productos_col.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["productos/write"]
}

resource "aws_apigatewayv2_route" "put_productos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "PUT /productos/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_productos_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["productos/write"]
}

resource "aws_apigatewayv2_route" "delete_productos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "DELETE /productos/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_productos_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["productos/write"]
}

# Stages
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api_manager.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.api_manager.id
  name        = "dev"
  auto_deploy = true
}
