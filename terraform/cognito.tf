# IDaaS: Directorio de Usuarios y Servidor de Autorización OAuth2/OIDC
resource "aws_cognito_user_pool" "pool" {
  name = "dsy1107-${lower(var.estudiante)}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # ESSENTIALS es obligatorio para habilitar el trigger Pre Token Generation V2_0
  user_pool_tier = "ESSENTIALS"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  # Asociación del trigger Pre Token Generation V2
  lambda_config {
    pre_token_generation_config {
      lambda_version = "V2_0"
      lambda_arn     = aws_lambda_function.user_token_ms.arn
    }
  }
}

# Dominio del Hosted UI (Managed Login v1)
resource "aws_cognito_user_pool_domain" "hosted_ui" {
  domain                = "dsy1107-${lower(var.estudiante)}"
  user_pool_id          = aws_cognito_user_pool.pool.id
  managed_login_version = 1
}

# Resource Server que define los scopes de la API de negocio
resource "aws_cognito_resource_server" "solicitudes" {
  identifier   = "solicitudes"
  name         = "API de Gestion de Solicitudes de Vacaciones"
  user_pool_id = aws_cognito_user_pool.pool.id

  scope {
    scope_name        = "read"
    scope_description = "Consultar solicitudes"
  }

  scope {
    scope_name        = "write"
    scope_description = "Crear, modificar y eliminar solicitudes"
  }

  scope {
    scope_name        = "approve"
    scope_description = "Aprobar o rechazar solicitudes"
  }
}

# Grupos de usuarios que representan los roles del sistema
resource "aws_cognito_user_group" "solicitantes" {
  name         = "solicitantes"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Usuarios con rol Solicitante (solicitudes/read, solicitudes/write)"
}

resource "aws_cognito_user_group" "aprobadores" {
  name         = "aprobadores"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Usuarios con rol Aprobador (solicitudes/read, solicitudes/approve)"
}

# Cliente público para la Single Page Application (SPA)
resource "aws_cognito_user_pool_client" "spa" {
  name         = "spa-react"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"] # Flujo Authorization Code con PKCE
  supported_identity_providers         = ["COGNITO"]

  # REGLA DE SEGURIDAD OBLIGATORIA (Perímetro RA1):
  # Los scopes de negocio (solicitudes/*) NO se declaran aquí;
  # son inyectados exclusivamente por el Lambda Pre-Token V2 según el grupo del usuario.
  allowed_oauth_scopes = [
    "openid",
    "email",
    "profile",
    "aws.cognito.signin.user.admin"
  ]

  callback_urls = [
    "http://localhost:5173/",
    "http://localhost:5173",
    "${local.url_amplify}/",
    local.url_amplify
  ]
  logout_urls = [
    "http://localhost:5173/",
    "http://localhost:5173",
    "${local.url_amplify}/",
    local.url_amplify
  ]

  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  access_token_validity = 60
  id_token_validity     = 60

  token_validity_units {
    access_token = "minutes"
    id_token     = "minutes"
  }

  depends_on = [
    aws_cognito_resource_server.solicitudes
  ]
}

# 1. Usuario Demo con Rol Solicitante
resource "aws_cognito_user" "solicitante_demo" {
  user_pool_id = aws_cognito_user_pool.pool.id
  username     = "solicitante@duocuc.cl"
  password     = "CloudNative2024"

  attributes = {
    email          = "solicitante@duocuc.cl"
    email_verified = true
    name           = "Empleado Solicitante"
  }

  message_action = "SUPPRESS"
}

resource "aws_cognito_user_in_group" "solicitante_grupo" {
  user_pool_id = aws_cognito_user_pool.pool.id
  group_name   = aws_cognito_user_group.solicitantes.name
  username     = aws_cognito_user.solicitante_demo.username
}

# 2. Usuario Demo con Rol Aprobador (Jefatura / RRHH)
resource "aws_cognito_user" "aprobador_demo" {
  user_pool_id = aws_cognito_user_pool.pool.id
  username     = "aprobador@duocuc.cl"
  password     = "CloudNative2024"

  attributes = {
    email          = "aprobador@duocuc.cl"
    email_verified = true
    name           = "Jefatura Aprobador"
  }

  message_action = "SUPPRESS"
}

resource "aws_cognito_user_in_group" "aprobador_grupo" {
  user_pool_id = aws_cognito_user_pool.pool.id
  group_name   = aws_cognito_user_group.aprobadores.name
  username     = aws_cognito_user.aprobador_demo.username
}
