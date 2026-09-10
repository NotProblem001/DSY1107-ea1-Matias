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
resource "aws_cognito_resource_server" "productos" {
  identifier   = "productos"
  name         = "API de Productos"
  user_pool_id = aws_cognito_user_pool.pool.id

  scope {
    scope_name        = "read"
    scope_description = "Consultar inventario de productos"
  }

  scope {
    scope_name        = "write"
    scope_description = "Crear, modificar y eliminar productos"
  }
}

# Grupos de usuarios que representan los roles del sistema
resource "aws_cognito_user_group" "lectores" {
  name         = "lectores"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Usuarios con permisos de solo lectura (productos/read)"
}

resource "aws_cognito_user_group" "editores" {
  name         = "editores"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Usuarios con permisos de lectura y escritura (productos/read y productos/write)"
}

# Cliente público para la Single Page Application (SPA)
resource "aws_cognito_user_pool_client" "spa" {
  name         = "spa-react"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"] # Flujo Authorization Code con PKCE
  supported_identity_providers         = ["COGNITO"]

  # REGLA DE SEGURIDAD OBLIGATORIA: Los scopes de negocio (productos/*) NO se declaran aquí;
  # son inyectados exclusivamente por el Lambda Pre-Token V2 según el grupo del usuario.
  allowed_oauth_scopes = [
    "openid",
    "email",
    "profile",
    "aws.cognito.signin.user.admin"
  ]

  callback_urls = [
    "http://localhost:5173/",
    "${local.url_amplify}/"
  ]
  logout_urls = [
    "http://localhost:5173/",
    "${local.url_amplify}/"
  ]

  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  access_token_validity = 60
  id_token_validity     = 60

  token_validity_units {
    access_token = "minutes"
    id_token     = "minutes"
  }

  depends_on = [
    aws_cognito_resource_server.productos
  ]
}

# Usuario de prueba inicial
resource "aws_cognito_user" "demo" {
  user_pool_id = aws_cognito_user_pool.pool.id
  username     = "alumno@duocuc.cl"
  password     = "CloudNative2024"

  attributes = {
    email          = "alumno@duocuc.cl"
    email_verified = true
    name           = "Alumno Demo"
  }

  message_action = "SUPPRESS"
}

# Asignación del usuario demo al grupo lectores
resource "aws_cognito_user_in_group" "demo_lector" {
  user_pool_id = aws_cognito_user_pool.pool.id
  group_name   = aws_cognito_user_group.lectores.name
  username     = aws_cognito_user.demo.username
}
