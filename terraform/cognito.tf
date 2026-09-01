# El user pool es el "tenant" de la guía 1.2.3: el directorio donde viven los
# usuarios y, a la vez, el servidor de autorización que emite los tokens.
resource "aws_cognito_user_pool" "pool" {
  name = "dsy1107-grupo05"
  # El correo es el nombre de usuario, como en cualquier CIAM.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }
  # Solo un administrador crea usuarios. Con auto-registro esto sería false.
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
}

resource "aws_cognito_user_pool_domain" "hosted_ui" {
  # OJO: este prefijo es único en TODA la región us-east-1, entre todas las
  # cuentas de AWS del mundo, no solo dentro de la nuestra. Con "dsy1107-grupo01"
  # el apply fallaba con "Domain already associated with another user pool"
  # porque otro grupo del curso ya lo había reclamado.
  domain       = "dsy1107-grupo05"
  user_pool_id = aws_cognito_user_pool.pool.id
  # 1 = Hosted UI clásica. La versión 2 (Managed Login) exige definir un
  # branding style o la pantalla de login queda en blanco.
  managed_login_version = 1
}

# Nuestro front en React es un CLIENTE PÚBLICO: su código se descarga completo
# en el navegador, así que no puede guardar un secreto. Por eso
# generate_secret = false y por eso el flujo es Authorization Code + PKCE.
resource "aws_cognito_user_pool_client" "spa" {
  name         = "spa-react"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  # Debe coincidir EXACTAMENTE con el redirect_uri que envíe la aplicación,
  # incluida la barra final. Es el error número uno de esta actividad.
  callback_urls = ["http://localhost:5173/"]
  logout_urls   = ["http://localhost:5173/"]

  # ALLOW_USER_PASSWORD_AUTH se habilita solo para poder probar por consola.
  # Más adelante se quita: una app nunca debe ver la contraseña del usuario.
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  # Tokens cortos a propósito: que expiren durante la clase es parte del ejercicio.
  access_token_validity = 60
  id_token_validity     = 60

  token_validity_units {
    access_token = "minutes"
    id_token     = "minutes"
  }
}

# Recurso para crear un usuario de prueba automáticamente
resource "aws_cognito_user" "demo" {
  user_pool_id = aws_cognito_user_pool.pool.id

  # El username debe ser el correo porque así lo definiste en el User Pool
  username = "alumno@duocuc.cl"

  # Debe cumplir con tu política: 8 caracteres, mayúscula, minúscula y número
  password = "CloudNative2024"

  attributes = {
    email          = "alumno@duocuc.cl"
    email_verified = true # Lo marcamos como verificado para que funcione de inmediato
    name           = "Test"
  }

  # SUPPRESS evita que AWS intente enviar un correo de bienvenida real al usuario
  message_action = "SUPPRESS"
}
