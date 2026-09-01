resource "aws_apigatewayv2_api" "api_manager" {
  name          = "api-mindicador"
  protocol_type = "HTTP"

  # Sin esto el navegador bloquea la llamada desde http://localhost:5173.
  # El front y la API están en orígenes distintos, así que el preflight OPTIONS
  # tiene que responder con estas cabeceras. "authorization" es imprescindible:
  # es la cabecera donde viaja el access token.
  #
  # El preflight lo responde API Gateway por su cuenta, ANTES del authorizer.
  # Si no fuera así, el OPTIONS llegaría sin token, daría 401, y el navegador
  # cancelaría la petición real sin llegar a enviarla nunca.
  cors_configuration {
    allow_origins = ["http://localhost:5173"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 300
  }
}

# Este es el paso que convierte el token en algo más que decoración: hasta
# ahora /datos respondía igual con token o sin él. Con el authorizer, API
# Gateway valida la firma del JWT contra las claves públicas del user pool
# (las publica en /.well-known/jwks.json) y comprueba emisor, audiencia y
# expiración ANTES de tocar la integración. Nada llega al backend sin un token
# legítimo y vigente.
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api_manager.id
  name             = "cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    # El front manda el ACCESS token, que no trae claim "aud" sino "client_id".
    # API Gateway lo sabe: cuando el token no tiene "aud", valida este valor
    # contra "client_id". Por eso aquí va el id del cliente y no otra cosa.
    audience = [aws_cognito_user_pool_client.spa.id]

    # El emisor: la URL del user pool. El atributo `endpoint` ya viene sin
    # esquema, así que hay que anteponerle https://.
    issuer = "https://${aws_cognito_user_pool.pool.endpoint}"
  }
}

resource "aws_apigatewayv2_integration" "backend" {
  api_id                 = aws_apigatewayv2_api.api_manager.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "GET"
  integration_uri        = "https://mindicador.cl/api"
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "datos" {
  api_id    = aws_apigatewayv2_api.api_manager.id
  route_key = "GET /datos"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"

  # A partir de aquí, /datos exige un token válido: sin él responde 401.
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

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
