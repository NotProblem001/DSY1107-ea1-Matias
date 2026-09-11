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

# 1. Integración Pública de Contraste (/publico/datos)
resource "aws_apigatewayv2_integration" "backend_publico_datos" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "GET"
  integration_uri        = "http://127.0.0.1:8080/publico/datos"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# 2. Integración Ruta Protegida (/datos)
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

# 3. Integración Colección /pedidos (GET, POST)
resource "aws_apigatewayv2_integration" "backend_pedidos_col" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://127.0.0.1:8080/pedidos"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# 4. Integración Elemento /pedidos/{proxy} (GET, PUT, DELETE)
resource "aws_apigatewayv2_integration" "backend_pedidos_ele" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://127.0.0.1:8080/pedidos/{proxy}"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# --- Rutas Protegidas y Públicas (Scope Guard en el Perímetro RA1) ---

# 1. Ruta pública sin autorizador (contraste y healthcheck)
resource "aws_apigatewayv2_route" "publico_datos" {
  api_id    = aws_apigatewayv2_api.api_manager.id
  route_key = "GET /publico/datos"
  target    = "integrations/${aws_apigatewayv2_integration.backend_publico_datos.id}"
}

# 2. Ruta protegida con scope openid (GET /datos)
resource "aws_apigatewayv2_route" "get_datos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /datos"
  target               = "integrations/${aws_apigatewayv2_integration.backend_datos.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["openid"]
}

# 3. Rutas de Lectura de Pedidos (requiere scope pedidos/read)
# Acceso permitido para: lectores, clientes, editores y administradores
resource "aws_apigatewayv2_route" "get_pedidos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /pedidos"
  target               = "integrations/${aws_apigatewayv2_integration.backend_pedidos_col.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["pedidos/read"]
}

resource "aws_apigatewayv2_route" "get_pedidos_id" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /pedidos/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_pedidos_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["pedidos/read"]
}

# 4. Rutas de Escritura de Pedidos (requiere scope pedidos/write)
# Acceso exclusivo para: editores y administradores (lectores/clientes reciben 403 Forbidden)
resource "aws_apigatewayv2_route" "post_pedidos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "POST /pedidos"
  target               = "integrations/${aws_apigatewayv2_integration.backend_pedidos_col.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["pedidos/write"]
}

resource "aws_apigatewayv2_route" "put_pedidos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "PUT /pedidos/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_pedidos_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["pedidos/write"]
}

resource "aws_apigatewayv2_route" "delete_pedidos" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "DELETE /pedidos/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_pedidos_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["pedidos/write"]
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
