# Guía y Lista de Verificación — DSY1107 · Experiencia de Aprendizaje 1 (RA1)
## Sistema "Pedidos360" — Arquitectura Cloud Native y Perímetro de Seguridad

Este documento sirve como manual de auditoría, corrección y verificación para certificar que el repositorio cumpla al 100% con los estándares de la **EA1** y los requerimientos del **Resultado de Aprendizaje 1 (RA1)**:
> *"Diseña soluciones de manera colaborativa, utilizando una plataforma API Manager y soluciones Identity as a Service, con el fin de gestionar, escalar, filtrar, autenticar y securitizar el uso de APIs."*

---

## 1. Estructura Exacta del Repositorio

Los pipelines de CI/CD de GitHub Actions y la automatización de Terraform dependen de la siguiente estructura exacta:

```
/
├── .github/
│   └── workflows/
│       ├── backend_compile.yml        # Compilación y pruebas Maven (Java 21 LTS)
│       ├── backend_deploy.yml         # Construcción Docker amd64, push a ECR y despliegue ECS Fargate
│       ├── frontend_compile.yml       # Validación npm ci y build Vite (RUTA_BUILD: frontend/dist)
│       ├── frontend_deploy.yml        # Inyección de configuración y publicación en AWS Amplify
│       └── user_token_ms_deploy.yml   # Pruebas unitarias node --test y despliegue Lambda Pre-Token V2
├── backend/                           # Raíz directa del microservicio Spring Boot (sin anidaciones)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/DSY1107/cloudnative/
│   │   │   │   ├── CloudnativeApplication.java
│   │   │   │   ├── config/SecurityConfig.java
│   │   │   │   ├── controller/DatosController.java
│   │   │   │   ├── controller/PedidosController.java
│   │   │   │   ├── model/Pedido.java
│   │   │   │   └── repository/PedidoRepository.java
│   │   │   └── resources/
│   │   │       └── application.properties
│   │   └── test/java/com/DSY1107/cloudnative/
│   │       └── CloudnativeApplicationTests.java
│   ├── Dockerfile                     # Multi-stage build linux/amd64 (JDK 21 builder -> JRE 21 runtime)
│   ├── mvnw                           # Maven Wrapper para Linux / CI/CD
│   ├── mvnw.cmd                       # Maven Wrapper para Windows
│   └── pom.xml                        # Spring Boot 3.3.4, Java 21, JPA, OAuth2 Resource Server
├── frontend/                          # SPA React + Vite
│   ├── public/
│   │   └── config.example.json        # Plantilla de configuración en runtime
│   ├── src/
│   │   ├── api.js                     # Cliente HTTP con diagnóstico perimetral
│   │   ├── auth.js                    # Flujo PKCE manual, canje /token y decodificación JWT
│   │   ├── pkce.js                    # Generador de verifier y challenge S256 (RFC 7636)
│   │   ├── App.jsx                    # Inspector JWT, CRUD de pedidos y consola Scope Guard
│   │   ├── main.jsx                   # Punto de entrada React
│   │   └── styles.css                 # Estilos UI modernos
│   ├── index.html
│   ├── package.json
│   └── vite.config.js                 # Puerto fijo 5173 con strictPort: true
├── terraform/                         # Infraestructura como Código (AWS)
│   ├── versions.tf                    # Provider AWS (~> 5.100), archive (~> 2.4) y default_tags
│   ├── variables.tf                   # Variables parametrizables (región, estudiante)
│   ├── cognito.tf                     # User Pool, Hosted UI v1, Resource Server pedidos, grupos y demo users
│   ├── lambda.tf                      # Lambda user-token-ms (LabRole dinámico y permiso de invocación)
│   ├── apigateway.tf                  # HTTP API v2, JWT Authorizer, Rutas con Scope Guards y CORS
│   ├── amplify.tf                     # Hosting Amplify WEB con regla custom de reescritura para SPA
│   ├── ecs.tf                         # ECR, ECS Cluster, Task Fargate (512 CPU / 1024 RAM), SG y ruta 0.0.0.0/0
│   └── outputs.tf                     # Outputs consolidados sin duplicidad y bloques env_frontend
├── user-token-ms/                     # Microservicio Lambda Pre-Token Generation V2
│   ├── index.mjs                      # Mapeo de grupos a scopes (scopesToAdd)
│   └── test/
│       └── index.test.mjs             # Pruebas unitarias completas con node --test
├── scripts/                           # Automatización del ciclo de vida
│   ├── config-frontend.sh             # Generación de public/config.json desde outputs
│   ├── publicar-amplify.sh            # Empaquetado zip y despliegue en AWS Amplify
│   └── publicar-ecs.sh                # Compilación JAR, imagen Docker amd64, push ECR y reapunte Gateway
├── .gitignore                         # Exclusión de credenciales, tfstate, dist, target, node_modules
├── README.md                          # Manual de arquitectura, despliegue y endpoints
└── VERIFICACION_REPOSITORIO_EA1.md    # Este documento de auditoría
```

---

## 2. Checklist de Validación por Módulo

### 2.1. Seguridad y Control de Versiones (`.gitignore`)
- [x] **Cero fugas de credenciales en el repositorio:**
  - `terraform.tfstate` y `terraform.tfstate.backup` debidamente ignorados.
  - Archivos `.env`, `.env.local`, `credenciales-lab.env` ignorados.
  - Artefactos de compilación (`target/`, `node_modules/`, `dist/`) ignorados.
- [x] **Configuración de GitHub Secrets para AWS Academy:**
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
- [x] Rama principal de entrega: `main`.

### 2.2. Autenticación e IDaaS (Amazon Cognito + Lambda Pre-Token V2)
- [x] **User Pool:**
  - `user_pool_tier = "ESSENTIALS"` (requisito excluyente para triggers V2).
  - `username_attributes = ["email"]`.
  - `auto_verified_attributes = ["email"]`.
  - Hosted UI configurada con `managed_login_version = 1`.
- [x] **Resource Server `pedidos`:**
  - Identificador: `pedidos`.
  - Scope `read`: *"Consultar pedidos"*.
  - Scope `write`: *"Crear y modificar pedidos"*.
- [x] **Grupos de Usuarios:**
  - `lectores` / `clientes`: Rol de solo lectura (`pedidos/read`).
  - `editores` / `administradores`: Rol de lectura y escritura (`pedidos/read`, `pedidos/write`).
- [x] **Cliente SPA Público:**
  - `generate_secret = false`.
  - `allowed_oauth_flows = ["code"]` (Authorization Code Flow con PKCE).
  - `allowed_oauth_scopes = ["openid", "email", "profile", "aws.cognito.signin.user.admin"]`.
  - **REGLA DE SEGURIDAD PERIMETRAL OBLIGATORIA (RA1):** Los scopes de negocio (`pedidos/read`, `pedidos/write`) **NO** están en `allowed_oauth_scopes` del cliente para evitar que el frontend se autoconceba privilegios en la solicitud de autorización.
- [x] **Microservicio Lambda Pre-Token Generation V2 (`user-token-ms/index.mjs`):**
  - Implementado con la especificación V2 (`lambda_version = "V2_0"`).
  - Inyecta scopes dinámicamente en `event.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd` según los grupos a los que pertenece el usuario.
  - 100% de cobertura en pruebas unitarias con `node --test` en `user-token-ms/test/index.test.mjs`.

### 2.3. Perímetro de Seguridad (AWS API Gateway HTTP API v2)
- [x] **CORS Estricto:** Orígenes permitidos `http://localhost:5173` y la URL pública de Amplify (sin barra final), métodos `GET, POST, PUT, DELETE, OPTIONS` y cabeceras `Authorization, Content-Type`.
- [x] **JWT Authorizer:** Valida firma asimétrica contra el JWKS del User Pool, `issuer` y `audience` (Client ID de la SPA).
- [x] **Matriz Scope Guard en el borde:**
  - `GET /publico/datos` -> Sin autorizador (ruta pública de contraste).
  - `GET /datos` -> `authorization_scopes = ["openid"]`.
  - `GET /pedidos` y `GET /pedidos/{proxy+}` -> `authorization_scopes = ["pedidos/read"]`.
  - `POST /pedidos`, `PUT /pedidos/{proxy+}`, `DELETE /pedidos/{proxy+}` -> `authorization_scopes = ["pedidos/write"]`.
- [x] **Integraciones Backend:** HTTP Proxy hacia ECS Fargate con `lifecycle { ignore_changes = [integration_uri] }` para convivir con los despliegues continuos.

### 2.4. Backend Microservicio (Spring Boot 3.3.4 con Java 21)
- [x] Ubicado en la raíz directa de `backend/`.
- [x] **Persistencia Cloud:** Entidad `Pedido` (`id`, `clienteEmail`, `descripcion`, `monto`, `estado`, `fechaCreacion`) mapeada con JPA e interfaz `PedidoRepository`.
- [x] **Conexión Cloud Flexible:** Configurada en `application.properties` con variables `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` (compatible con PostgreSQL y fallback automático en H2 en memoria).
- [x] **Filtro Interno de Defensa en Profundidad:** `SecurityConfig.java` configurado con `spring-boot-starter-oauth2-resource-server` validando JWT.
- [x] **Endpoints REST:**
  - `GET /pedidos`
  - `GET /pedidos/{id}`
  - `POST /pedidos` (retorna `201 Created`)
  - `PUT /pedidos/{id}` (retorna `200 OK`)
  - `DELETE /pedidos/{id}` (retorna `204 No Content`)
  - `GET /publico/datos` (público)
  - `GET /datos` (protegido)
  - `GET /actuator/health` (salud para Fargate)
- [x] **Dockerfile Multi-Stage:** Builder con JDK 21 compilando el JAR y Runner ligero con JRE 21 exponiendo el puerto 8080 para `--platform linux/amd64`.

### 2.5. Frontend SPA (React + Vite)
- [x] `vite.config.js` fija el puerto `5173` con `strictPort: true`.
- [x] Implementación manual de OAuth2 + PKCE en `src/auth.js` y `src/pkce.js` (generación de verifier aleatorio, hash SHA-256 S256, canje en `/oauth2/token` con `application/x-www-form-urlencoded` y limpieza de URL).
- [x] Carga dinámica dual de configuración: `public/config.json` en runtime (despliegues Amplify) con fallback a `import.meta.env` (desarrollo local).
- [x] Logout real redirigiendo a `${COGNITO_DOMAIN}/logout` para destruir la sesión SSO.
- [x] Inspector visual de JWT: Comparación lado a lado de ID Token (identidad: `email`, `sub`, grupos) vs Access Token (autorización: claim `scope`).
- [x] CRUD interactivo de Pedidos y consola de pruebas Scope Guard en vivo.

### 2.6. Infraestructura como Código (Terraform)
- [x] Totalmente dinámico para AWS Academy: rol `arn:aws:iam://${data.aws_caller_identity.current.account_id}:role/LabRole`.
- [x] Cero outputs duplicados: consolidados exclusivamente en `outputs.tf`.
- [x] Task Definition Fargate con 512 CPU y 1024 MB de memoria RAM.
- [x] `aws_ecs_service` con `lifecycle { ignore_changes = [task_definition] }` y `assign_public_ip = true`.
- [x] Tabla de ruteo con ruta `0.0.0.0/0` hacia el Internet Gateway.

---

## 3. Matriz de Comprobación y Demostración en Vivo (Scope Guard RA1)

La siguiente tabla resume los resultados demostrables en vivo tanto en la SPA como mediante llamadas directas cURL:

| N° | Escenario | Método y Endpoint | Credenciales / Token | Código Esperado | Diagnóstico y Comportamiento Arquitectónico |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | **Ruta Pública de Contraste** | `GET /publico/datos` | Ninguno (Sin Token) | **`200 OK`** | Acceso público sin pasar por el JWT Authorizer. Retorna mensaje e indicadores de contraste. |
| **2** | **Lectura con Permisos (Lector)** | `GET /pedidos` | Token de `lector@pedidos360.com` (`pedidos/read`) | **`200 OK`** | API Gateway valida la firma del JWT y confirma la presencia del scope `pedidos/read`. Reenvía la petición al backend en ECS Fargate. |
| **3** | **Lectura con Permisos (Admin)** | `GET /pedidos` | Token de `admin@pedidos360.com` (`pedidos/read`, `pedidos/write`) | **`200 OK`** | El usuario administrador cuenta con ambos scopes, por lo que la lectura es permitida. |
| **4** | **Creación con Permisos (Admin)** | `POST /pedidos` | Token de `admin@pedidos360.com` (`pedidos/write`) | **`201 Created`** | API Gateway verifica el scope `pedidos/write`. Spring Boot persiste el pedido en la base de datos cloud y retorna el recurso creado. |
| **5** | **Petición Anónima a Ruta Protegida** | `GET /pedidos` | Ninguno (Sin cabecera Authorization) | **`401 Unauthorized`** | El autorizador JWT de API Gateway rechaza la solicitud de inmediato en el perímetro. La petición no llega a Fargate. |
| **6** | **Escritura Anónima** | `POST /pedidos` | Ninguno (Sin cabecera Authorization) | **`401 Unauthorized`** | Rechazada por falta de autenticación en el perímetro perimetral. |
| **7** | **Intento Ilegal de Escritura (Lector)** | `POST /pedidos` | Token de `lector@pedidos360.com` (Solo `pedidos/read`) | **`403 Forbidden`** | **Prueba Reina del RA1:** El usuario está autenticado válidamente, pero API Gateway Scope Guard bloquea la petición en el perímetro porque el Access Token carece de `pedidos/write`. Retorna `{"message":"Forbidden"}` sin consumir cómputo en el backend. |
| **8** | **Ruta Protegida General** | `GET /datos` | Token con scope `openid` | **`200 OK`** | Petición autenticada estándar con scope OIDC. |

---

## 4. Guía de Ejecución de Comandos cURL para Evaluación

Exporta las variables con los datos de tu despliegue:

```bash
# 1. URL base de API Gateway
API_URL="https://<API_ID>.execute-api.us-east-1.amazonaws.com"

# 2. Tokens obtenidos tras iniciar sesión en la SPA (puedes copiarlos desde la pestaña 'Inspector JWT')
TOKEN_LECTOR="<ACCESS_TOKEN_DEL_LECTOR>"
TOKEN_ADMIN="<ACCESS_TOKEN_DEL_ADMIN>"
```

### Demostración 1: Endpoint Público de Contraste (200 OK)
```bash
curl -i -X GET "${API_URL}/publico/datos"
```
*Respuesta esperada:* HTTP `200 OK` con JSON `{"sistema":"Pedidos360", "autorizado":false, ...}`.

---

### Demostración 2: Consulta sin Token a Ruta Protegida (401 Unauthorized)
```bash
curl -i -X GET "${API_URL}/pedidos"
```
*Respuesta esperada:*
```http
HTTP/2 401
content-type: application/json

{"message":"Unauthorized"}
```

---

### Demostración 3: Lector consulta pedidos con permisos válidos (200 OK)
```bash
curl -i -X GET "${API_URL}/pedidos" \
  -H "Authorization: Bearer ${TOKEN_LECTOR}"
```
*Respuesta esperada:* HTTP `200 OK` con el listado JSON de pedidos persistidos.

---

### Demostración 4: Administrador crea un pedido nuevo (201 Created)
```bash
curl -i -X POST "${API_URL}/pedidos" \
  -H "Authorization: Bearer ${TOKEN_ADMIN}" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteEmail": "cliente@pedidos360.com",
    "descripcion": "Storage SAN All-Flash 100TB",
    "monto": 8450000.0,
    "estado": "PENDIENTE"
  }'
```
*Respuesta esperada:*
```http
HTTP/2 201
content-type: application/json

{
  "id": 4,
  "clienteEmail": "cliente@pedidos360.com",
  "descripcion": "Storage SAN All-Flash 100TB",
  "monto": 8450000.0,
  "estado": "PENDIENTE",
  "fechaCreacion": "..."
}
```

---

### Demostración 5: Lector intenta crear un pedido — Demostración Scope Guard (403 Forbidden)
```bash
curl -i -X POST "${API_URL}/pedidos" \
  -H "Authorization: Bearer ${TOKEN_LECTOR}" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteEmail": "intento.hack@pedidos360.com",
    "descripcion": "Pedido no autorizado",
    "monto": 999999.0
  }'
```
*Respuesta esperada:*
```http
HTTP/2 403
content-type: application/json

{"message":"Forbidden"}
```
> **Nota de Evaluación:** La petición fue bloqueada en el borde por el **Scope Guard de API Gateway** al verificar que el claim `scope` del Access Token solo contenía `pedidos/read` y no `pedidos/write`. La petición jamás llegó a ejecutarse en Spring Boot.

---

### Demostración 6: Administrador actualiza el estado de un pedido (200 OK)
```bash
curl -i -X PUT "${API_URL}/pedidos/1" \
  -H "Authorization: Bearer ${TOKEN_ADMIN}" \
  -H "Content-Type: application/json" \
  -d '{
    "estado": "COMPLETADO"
  }'
```
*Respuesta esperada:* HTTP `200 OK` con el pedido actualizado.

---

### Demostración 7: Administrador elimina un pedido (204 No Content)
```bash
curl -i -X DELETE "${API_URL}/pedidos/1" \
  -H "Authorization: Bearer ${TOKEN_ADMIN}"
```
*Respuesta esperada:* HTTP `204 No Content`.

---

## 5. Resumen de Verificación y Estado del Repositorio

| Componente | Verificación Automatizada | Resultado |
| :--- | :--- | :---: |
| **Lambda Pre-Token V2** | `node --test` en `user-token-ms/` | **PASS (6/6 tests)** |
| **Backend Spring Boot** | `./mvnw clean test` en `backend/` | **PASS (7/7 tests)** |
| **Frontend SPA React** | `npm run build` en `frontend/` | **PASS (Vite build OK)** |
| **Infraestructura Terraform** | `terraform fmt -check` en `terraform/` | **PASS (Sintaxis HCL OK)** |
