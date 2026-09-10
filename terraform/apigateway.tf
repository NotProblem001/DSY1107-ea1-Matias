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

# 1. Integración Pública para Información y Contraste
resource "aws_apigatewayv2_integration" "backend_publico_info" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "GET"
  integration_uri        = "http://127.0.0.1:8080/publico/info"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# 2. Integración Colección /solicitudes (GET, POST)
resource "aws_apigatewayv2_integration" "backend_solicitudes_col" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://127.0.0.1:8080/solicitudes"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# 3. Integración Elemento /solicitudes/{proxy} (GET, PUT, DELETE)
resource "aws_apigatewayv2_integration" "backend_solicitudes_ele" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "http://127.0.0.1:8080/solicitudes/{proxy}"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# 4. Integración Acción Aprobar /solicitudes/{id}/aprobar (POST)
resource "aws_apigatewayv2_integration" "backend_solicitudes_apr" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "POST"
  integration_uri        = "http://127.0.0.1:8080/solicitudes/{id}/aprobar"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# 5. Integración Acción Rechazar /solicitudes/{id}/rechazar (POST)
resource "aws_apigatewayv2_integration" "backend_solicitudes_rec" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "POST"
  integration_uri        = "http://127.0.0.1:8080/solicitudes/{id}/rechazar"
  payload_format_version = "1.0"

  lifecycle {
    ignore_changes = [integration_uri]
  }
}

# --- Rutas Protegidas y Públicas (Scope Guard en el Perímetro RA1) ---

# 1. Ruta pública sin autorizador (para contraste y healthcheck informativo)
resource "aws_apigatewayv2_route" "publico_info" {
  api_id    = aws_apigatewayv2_api.api_manager.id
  route_key = "GET /publico/info"
  target    = "integrations/${aws_apigatewayv2_integration.backend_publico_info.id}"
}

# 2. Rutas de Lectura de Solicitudes (requiere solicitudes/read)
# Acceso permitido para: solicitantes y aprobadores
resource "aws_apigatewayv2_route" "get_solicitudes" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /solicitudes"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_col.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/read"]
}

resource "aws_apigatewayv2_route" "get_solicitudes_id" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "GET /solicitudes/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/read"]
}

# 3. Rutas de Escritura de Solicitudes (requiere solicitudes/write)
# Acceso exclusivo para: solicitantes (aprobadores son rechazados con 403 Forbidden)
resource "aws_apigatewayv2_route" "post_solicitudes" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "POST /solicitudes"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_col.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/write"]
}

resource "aws_apigatewayv2_route" "put_solicitudes" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "PUT /solicitudes/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/write"]
}

resource "aws_apigatewayv2_route" "delete_solicitudes" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "DELETE /solicitudes/{proxy+}"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_ele.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/write"]
}

# 4. Rutas de Aprobación y Rechazo (requiere solicitudes/approve)
# Acceso exclusivo para: aprobadores (solicitantes son rechazados con 403 Forbidden)
resource "aws_apigatewayv2_route" "post_solicitudes_aprobar" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "POST /solicitudes/{id}/aprobar"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_apr.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/approve"]
}

resource "aws_apigatewayv2_route" "post_solicitudes_rechazar" {
  api_id               = aws_apigatewayv2_api.api_manager.id
  route_key            = "POST /solicitudes/{id}/rechazar"
  target               = "integrations/${aws_apigatewayv2_integration.backend_solicitudes_rec.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.cognito.id
  authorization_scopes = ["solicitudes/approve"]
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
