resource "aws_amplify_app" "front" {
  name     = "dsy1107-${var.estudiante}"
  platform = "WEB"

  # Regla de reescritura para SPA: redirige rutas a /index.html sin atrapar archivos estáticos ni /config.json
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.front.id
  branch_name = "main"
  framework   = "React"
  stage       = "PRODUCTION"
}

locals {
  url_amplify = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.front.default_domain}"
}
