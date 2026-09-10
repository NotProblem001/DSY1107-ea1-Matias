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
  - `user_pool_tier = "ESSENTIALS"` (Obligatorio para Pre Token Generation V2_0).
- [x] **Hosted UI & Domain:** Dominio configurado con `managed_login_version = 1`.
- [x] **User Pool Client (SPA):**
  - `generate_secret = false` (Cliente público).
  - `allowed_oauth_flows = ["code"]` (Authorization Code Flow con PKCE).
  - `allowed_oauth_scopes = ["openid", "email", "profile", "aws.cognito.signin.user.admin"]`.
  - **REGLA DE SEGURIDAD PERIMETRAL (RA1):** Los scopes de negocio (`solicitudes/read`, `solicitudes/write`, `solicitudes/approve`) **NO** están en `allowed_oauth_scopes` del cliente (son inyectados dinámicamente por el Lambda Pre-Token V2).
  - `callback_urls` y `logout_urls` contienen `http://localhost:5173/` y la URL pública de Amplify con `/` final.
- [x] **Resource Server:**
  - `identifier = "solicitudes"` con 3 scopes declarados:
    * `read` -> "Consultar solicitudes"
    * `write` -> "Crear, modificar y eliminar solicitudes"
    * `approve` -> "Aprobar o rechazar solicitudes"
- [x] **Grupos de Usuarios:**
  - `solicitantes`: Rol con permisos de consulta y radicación (`solicitudes/read`, `solicitudes/write`).
  - `aprobadores`: Rol con permisos de consulta y decisión (`solicitudes/read`, `solicitudes/approve`).
  - Usuarios demo precargados: `solicitante@duocuc.cl` y `aprobador@duocuc.cl`.
- [x] **Lambda Pre Token Generation V2 (`user-token-ms`):**
  - `lambda_version = "V2_0"`.
  - Inyecta scopes según grupo vía `claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd`.
  - Recurso `aws_lambda_permission` configurado para invocar desde Cognito.

### 2.4. API Manager (Scope Guard en el Perímetro) — `terraform/apigateway.tf`
- [x] **HTTP API (v2):** Configuración de CORS con `allow_origins = ["http://localhost:5173", "https://main.<app_id>.amplifyapp.com"]` (sin barra final) y headers `Authorization`, `Content-Type`.
- [x] **JWT Authorizer:**
  - `identity_sources = ["$request.header.Authorization"]`
  - `issuer = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"`
  - `audience = [aws_cognito_user_pool_client.spa.id]`
- [x] **Rutas Protegidas por Scopes (Scope Guard):**
  - `GET /publico/info` -> Sin autorizador (ruta pública de contraste).
  - `GET /solicitudes` y `GET /solicitudes/{proxy+}` -> `authorization_scopes = ["solicitudes/read"]`
  - `POST /solicitudes`, `PUT /solicitudes/{proxy+}`, `DELETE /solicitudes/{proxy+}` -> `authorization_scopes = ["solicitudes/write"]`
  - `POST /solicitudes/{id}/aprobar` -> `authorization_scopes = ["solicitudes/approve"]`
  - `POST /solicitudes/{id}/rechazar` -> `authorization_scopes = ["solicitudes/approve"]`
- [x] **Integraciones Backend:** Integraciones HTTP Proxy hacia ECS Fargate con `lifecycle { ignore_changes = [integration_uri] }`.

### 2.5. Frontend SPA — `frontend/`
- [x] `vite.config.js` fija el puerto `5173` con `strictPort: true`.
- [x] Flujo PKCE completo: generación de `code_verifier` y `code_challenge` S256 en login, almacenamiento en `sessionStorage`, canje en `/oauth2/token` y limpieza de URL.
- [x] Vista Solicitante: formulario para radicar solicitudes, tabla de solicitudes propias y acciones de edición/eliminación.
- [x] Vista Aprobador: tabla de solicitudes pendientes, campo para observaciones y botones de Aprobar/Rechazar.
- [x] Consola interactiva de validación del Scope Guard perimetral (401, 200, 201, 403).
- [x] Inspección visual de tokens: ID Token (identidad) vs Access Token (scopes concedidos).

### 2.6. Amplify & Backend Fargate
- [x] `aws_amplify_app` en modo `WEB` con `custom_rule` de reescritura para SPA hacia `/index.html` (preservando `/config.json`).
- [x] `backend/pom.xml` configurado con Spring Boot y Java 21 LTS.
- [x] Controlador `SolicitudesController` y modelo `SolicitudVacaciones` implementados con cero lógica manual de autorización (seguridad delegada 100% al perímetro).
- [x] Dockerfile multi-stage construido para `--platform linux/amd64`.
- [x] `aws_ecs_service` con `assign_public_ip = true` y `lifecycle { ignore_changes = [task_definition] }`.

---

## 3. Matriz de Comprobación y Demostración (Scope Guard RA1)

| Escenario | Método y Endpoint | Rol / Token | Código HTTP | Diagnóstico y Punto de Validación |
| :--- | :--- | :--- | :--- | :--- |
| **1. Sin Token** | `GET /solicitudes` | Ninguno | `401 Unauthorized` | API Gateway JWT Authorizer bloquea petición anónima. |
| **2. Ruta Pública** | `GET /publico/info` | Ninguno | `200 OK` | Ruta sin autorizador permite acceso directo de contraste. |
| **3. Consulta Solicitante** | `GET /solicitudes` | Solicitante (`solicitudes/read`) | `200 OK` | API Gateway valida scope de lectura y hace proxy al backend. |
| **4. Creación Solicitante** | `POST /solicitudes` | Solicitante (`solicitudes/write`) | `201 Created` | Backend registra solicitud con estado inicial `PENDIENTE`. |
| **5. Intento Ilegal Solicitante** | `POST /solicitudes/1/aprobar` | Solicitante (`solicitudes/write`) | `403 Forbidden` | Scope Guard de API Gateway rechaza en el perímetro (falta `approve`). |
| **6. Aprobación Jefatura** | `POST /solicitudes/1/aprobar` | Aprobador (`solicitudes/approve`) | `200 OK` | API Gateway valida scope `approve` y backend cambia estado a `APROBADA`. |
| **7. Intento Ilegal Aprobador** | `POST /solicitudes` | Aprobador (`solicitudes/approve`) | `403 Forbidden` | Scope Guard rechaza porque el aprobador no tiene `solicitudes/write`. |

---

## 4. Comandos de Verificación con cURL

Exporta tus variables de entorno para ejecutar las comprobaciones:
```bash
API_URL="https://<API_ID>.execute-api.us-east-1.amazonaws.com"
TOKEN_SOLICITANTE="<ACCESS_TOKEN_DEL_SOLICITANTE>"
TOKEN_APROBADOR="<ACCESS_TOKEN_DEL_APROBADOR>"
```

### Escenario 1: Petición sin token (Esperado HTTP 401 Unauthorized)
```bash
curl -i -X GET "${API_URL}/solicitudes"
```

### Escenario 2: Endpoint público de contraste (Esperado HTTP 200 OK)
```bash
curl -i -X GET "${API_URL}/publico/info"
```

### Escenario 3: Solicitante consulta sus solicitudes (Esperado HTTP 200 OK)
```bash
curl -i -X GET "${API_URL}/solicitudes" \
  -H "Authorization: Bearer ${TOKEN_SOLICITANTE}"
```

### Escenario 4: Solicitante crea una nueva solicitud (Esperado HTTP 201 Created)
```bash
curl -i -X POST "${API_URL}/solicitudes" \
  -H "Authorization: Bearer ${TOKEN_SOLICITANTE}" \
  -H "Content-Type: application/json" \
  -d '{
    "solicitanteEmail": "solicitante@duocuc.cl",
    "fechaInicio": "2026-03-01",
    "fechaFin": "2026-03-15",
    "dias": 14,
    "motivo": "Vacaciones legales anuales"
  }'
```

### Escenario 5: Solicitante intenta aprobar (Esperado HTTP 403 Forbidden por Scope Guard)
```bash
curl -i -X POST "${API_URL}/solicitudes/1/aprobar" \
  -H "Authorization: Bearer ${TOKEN_SOLICITANTE}" \
  -H "Content-Type: application/json" \
  -d '{"comentario": "Auto-aprobación no permitida"}'
```
*Respuesta esperada:*
```json
{"message":"Forbidden"}
```
*(Nótese que la petición ni siquiera llega a Spring Boot; es rechazada en el borde por API Gateway).*

### Escenario 6: Aprobador aprueba la solicitud (Esperado HTTP 200 OK)
```bash
curl -i -X POST "${API_URL}/solicitudes/1/aprobar" \
  -H "Authorization: Bearer ${TOKEN_APROBADOR}" \
  -H "Content-Type: application/json" \
  -d '{
    "comentario": "Aprobado conforme al plan de contingencia del equipo.",
    "aprobadorEmail": "aprobador@duocuc.cl"
  }'
```
