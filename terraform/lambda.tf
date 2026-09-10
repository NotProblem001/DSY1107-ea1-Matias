# Empaquetado del microservicio Lambda Pre Token Generation V2
data "archive_file" "user_token_ms" {
  type        = "zip"
  source_file = "${path.module}/../user-token-ms/index.mjs"
  output_path = "${path.module}/../user-token-ms.zip"
}

# Rol existente del Learner Lab (evita fallos de permisos IAM en AWS Academy)
data "aws_iam_role" "lab_role" {
  name = var.lab_role_name
}

resource "aws_lambda_function" "user_token_ms" {
  function_name    = "user-token-ms-${lower(var.estudiante)}"
  role             = data.aws_iam_role.lab_role.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.user_token_ms.output_path
  source_code_hash = data.archive_file.user_token_ms.output_base64sha256
  timeout          = 5

  description = "Trigger Pre-Token Generation V2 para inyectar scopes a partir de grupos"
}

# Permiso para que Amazon Cognito pueda invocar el Lambda
resource "aws_lambda_permission" "cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_token_ms.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}
