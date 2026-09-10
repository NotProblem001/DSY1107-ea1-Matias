# Guía y Lista de Verificación — DSY1107 · Experiencia de Aprendizaje 1 (RA1)

Este documento sirve como manual de auditoría, corrección y verificación para asegurar que el repositorio cumpla con los estándares de la **EA1** y los requerimientos del **Resultado de Aprendizaje 1 (RA1)**:
> *"Diseña soluciones de manera colaborativa, utilizando una plataforma API Manager y soluciones Identity as a Service, con el fin de gestionar, escalar, filtrar, autenticar y securitizar el uso de APIs."*

---

## 1. Estructura Exacta del Repositorio

Los pipelines de GitHub Actions dependen de nombres y rutas exactas. Cualquier anidación imprevista (como `backend/cloudnative/pom.xml` en lugar de `backend/pom.xml`) causa errores de compilación en CI/CD.

```
/
├── .github/
│   └── workflows/
│       ├── backend_compile.yml        # Compilación y test Maven (Java 21)
│       ├── backend_deploy.yml         # Build Docker y push a ECR / ECS Fargate
│       ├── frontend_compile.yml       # npm ci + npm run build
│       ├── frontend_deploy.yml        # Despliegue en AWS Amplify
│       └── user_token_ms_deploy.yml   # (Opcional) Despliegue Lambda Pre-Token V2
├── backend/                           # Raíz directa del microservicio Spring Boot
│   ├── src/
│   │   ├── main/java/com/DSY1107/...
│   │   └── test/java/com/DSY1107/...
│   ├── Dockerfile                     # Construcción para plataforma linux/amd64
│   ├── mvnw
│   ├── mvnw.cmd
│   └── pom.xml                        # pom.xml directamente en backend/
├── frontend/                          # SPA React (Vite) o Angular
│   ├── public/                        # Estáticos (recibe config.json)
│   ├── src/
│   │   ├── api.js                     # Clientes hacia API Gateway y Cognito
│   │   ├── auth.js                    # Flujo PKCE, canje /token y decodificación JWT
│   │   ├── pkce.js                    # Generador de verifier y challenge S256
│   │   ├── App.jsx / main.jsx         # UI y visualizador de claims
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js                 # Puerto fijo 5173 con strictPort: true
├── terraform/                         # Infraestructura como Código (AWS)
│   ├── versions.tf                    # Provider AWS (~> 5.100) y default_tags
│   ├── variables.tf                   # Variables parametrizables
│   ├── cognito.tf                     # User Pool, Client, Hosted UI, Resource Server, Groups, Trigger V2
│   ├── apigateway.tf                  # HTTP API, JWT Authorizer, Rutas con Scopes, CORS
│   ├── amplify.tf                     # App WEB Amplify, Branch main, Custom Rewrite Rule
│   ├── ecs.tf                         # ECR, Cluster ECS, Task Definition Fargate, Service, SG, Ruta 0.0.0.0/0
│   ├── lambda.tf                      # Lambda user-token-ms y permisos de invocación
│   └── outputs.tf                     # env_frontend, URLs, IDs de cliente y endpoints
├── user-token-ms/                     # Microservicio Lambda Pre-Token Generation V2
│   ├── index.mjs                      # Mapeo de grupos a scopes (scopesToAdd)
│   └── test/                          # Pruebas unitarias ejecutadas con node --test
├── scripts/                           # Automatización del ciclo de vida
│   ├── config-frontend.sh             # Inyecta outputs de Terraform a public/config.json
│   ├── publicar-amplify.sh            # Empaqueta y despliega zip en Amplify
│   └── publicar-ecs.sh                # Compila jar, docker build amd64, push a ECR
├── .gitignore                         # Exclusiones de seguridad y artefactos
└── README.md                          # Arquitectura, endpoints y guía de ejecución
```

---

## 2. Checklist de Validación por Módulo

### 2.1. Seguridad y `.gitignore` (Crítico)
- [x] **Sin credenciales ni estados en el repositorio:**
  - `terraform/terraform.tfstate` y `terraform/terraform.tfstate.backup` están en `.gitignore`.
  - `terraform/*.tfvars` reales ignorados (solo versionar `*.tfvars.example`).
  - `credenciales-lab.env`, `.env`, `.env.local` ignorados.
  - Artefactos ignorados: `.terraform/`, `node_modules/`, `dist/`, `target/`.
- [x] **GitHub Secrets configurados:**
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
  *(Se actualizan al iniciar cada sesión del Learner Lab).*

### 2.2. Rama de Trabajo
- [x] La rama de entrega es `main`.
- [x] No existen ramas sueltas o Pull Requests sin fusionar.

### 2.3. Identity as a Service (IDaaS) — `terraform/cognito.tf`
- [x] **User Pool:**
  - `username_attributes = ["email"]`
  - `user_pool_tier = "ESSENTIALS"` (Necesario para Pre Token Generation V2_0).
- [x] **Hosted UI & Domain:** Dominio configurado con `managed_login_version = 1`.
- [x] **User Pool Client (SPA):**
  - `generate_secret = false` (Cliente público).
  - `allowed_oauth_flows = ["code"]` (Authorization Code Flow con PKCE).
  - `allowed_oauth_scopes = ["openid", "email", "profile", "aws.cognito.signin.user.admin"]`.
  - **REGLA DE SEGURIDAD:** Los scopes de negocio (`productos/read`, `productos/write`) **NO** están en `allowed_oauth_scopes` del cliente (solo los concede el Lambda).
  - `callback_urls` y `logout_urls` contienen `http://localhost:5173/` y la URL pública de Amplify con `/` final.
- [x] **Resource Server:**
  - `identifier = "productos"` con scopes `read` y `write`.
- [x] **Grupos de Usuarios:**
  - Grupos `lectores` y `editores`.
  - Usuario de prueba demo en `lectores`.
- [x] **Lambda Pre Token Generation V2:**
  - `lambda_version = "V2_0"`.
  - El código JS/MJS añade scopes vía `claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd`.
  - Recurso `aws_lambda_permission` configurado para invocar desde Cognito.

### 2.4. API Manager — `terraform/apigateway.tf`
- [x] **HTTP API (v2):** Configuración de CORS con `allow_origins = ["http://localhost:5173", "https://main.<app_id>.amplifyapp.com"]` (sin barra final) y headers `Authorization`, `Content-Type`.
- [x] **JWT Authorizer:**
  - `identity_sources = ["$request.header.Authorization"]`
  - `issuer = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"`
  - `audience = [aws_cognito_user_pool_client.spa.id]`
- [x] **Rutas Protegidas por Scopes:**
  - `GET /datos` -> `authorization_scopes = ["openid"]`
  - `GET /productos` -> `authorization_scopes = ["productos/read"]`
  - `GET /productos/{proxy+}` -> `authorization_scopes = ["productos/read"]`
  - `POST /productos` -> `authorization_scopes = ["productos/write"]`
  - `PUT /productos/{proxy+}` -> `authorization_scopes = ["productos/write"]`
  - `DELETE /productos/{proxy+}` -> `authorization_scopes = ["productos/write"]`
- [x] **Integraciones Backend:** Separadas entre `/datos` y microservicio CRUD de `/productos`.

### 2.5. Frontend SPA — `frontend/`
- [x] `vite.config.js` fija el puerto `5173` con `strictPort: true`.
- [x] Flujo PKCE completo: generación de `code_verifier` y `code_challenge` S256 en login, almacenamiento temporal en `sessionStorage`, canje en `/oauth2/token` y limpieza de URL.
- [x] Inspección visual de tokens: ID Token (datos de usuario) vs Access Token (scopes).
- [x] Botones para probar endpoints con y sin token.
- [x] Botón de Logout llamando a `/logout` de Cognito para invalidar la sesión SSO.

### 2.6. Amplify & Backend Fargate
- [x] `aws_amplify_app` en modo `WEB` con `custom_rule` de reescritura para SPA hacia `/index.html` (preservando `/config.json`).
- [x] `backend/pom.xml` configurado con Spring Boot y Java 21.
- [x] Dockerfile construido para `--platform linux/amd64`.
- [x] `aws_route.salida_a_internet` declarada (`0.0.0.0/0`) en la tabla de ruteo de la VPC.
- [x] `aws_ecs_service` con `assign_public_ip = true` y `lifecycle { ignore_changes = [task_definition] }`.

---

## 3. Matriz de Comprobación y Demostración

| Escenario | Petición | Respuesta Esperada | Punto de Validación |
| :--- | :--- | :--- | :--- |
| **Sin Token** | `GET /productos` | `401 Unauthorized` | API Gateway Authorizer |
| **Token Lector** | `GET /productos` | `200 OK` | Backend Spring Boot |
| **Lector en POST** | `POST /productos` | `403 Forbidden` | API Gateway Scope Guard |
| **Editor en POST** | `POST /productos` | `201 Created` | Backend Spring Boot |
| **Ruta Pública** | `GET /publico/datos` | `200 OK` | Integración directa |

---

## 4. Comandos de Verificación Rápida

### Comprobar estructura de archivos localmente:
```bash
# Verificar que backend no esté anidado
ls -la backend/pom.xml backend/Dockerfile

# Verificar scripts con permisos de ejecución
chmod +x scripts/*.sh

# Verificar sintaxis y formateo de Terraform
cd terraform
terraform fmt -check
terraform validate
```

### Probar endpoints con cURL y JWT:
```bash
# Probar 401
curl -i -X GET https://<API_GATEWAY_URL>/productos

# Probar 403 vs 200 con Access Token
curl -i -X GET https://<API_GATEWAY_URL>/productos \
  -H "Authorization: Bearer $ACCESS_TOKEN"

curl -i -X POST https://<API_GATEWAY_URL>/productos \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Producto Demo","precio":9990}'
```
