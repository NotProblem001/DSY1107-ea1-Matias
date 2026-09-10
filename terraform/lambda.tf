# Empaquetado dinámico del código del trigger Pre Token Generation V2
data "archive_file" "user_token_ms" {
  type        = "zip"
  source_file = "${path.module}/../user-token-ms/index.mjs"
  output_path = "${path.module}/../user-token-ms.zip"
}

# Función Lambda Pre-Token Generation V2
resource "aws_lambda_function" "user_token_ms" {
  function_name = "user-token-ms-${lower(var.estudiante)}"
  # ARN del rol resuelto dinámicamente según la cuenta activa de AWS Academy
  role             = "arn:aws:iam://${data.aws_caller_identity.current.account_id}:role/LabRole"
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.user_token_ms.output_path
  source_code_hash = data.archive_file.user_token_ms.output_base64sha256
  timeout          = 5

  description = "Trigger Pre-Token Generation V2 para inyección de scopes por grupos de Cognito"
}

# Permiso para invocación desde Amazon Cognito
resource "aws_lambda_permission" "cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_token_ms.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}
