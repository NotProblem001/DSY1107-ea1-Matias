# DSY1107 · Experiencia de Aprendizaje 1 (RA1)
> **Diseño y Despliegue de Solución Cloud Native con API Manager (API Gateway) e IDaaS (Amazon Cognito)**

Repositorio oficial para la **EA1** de la asignatura **Desarrollo Cloud Native I (DSY1107)**. Implementa una arquitectura desacoplada de extremo a extremo que gestiona, autentica, filtra y securitiza el consumo de APIs a través de estándares abiertos (OAuth 2.0, OpenID Connect, PKCE y JWT).

---

## 1. Arquitectura de la Solución

La solución consta de los siguientes componentes principales integrados en AWS:

1. **Identity as a Service (IDaaS) — Amazon Cognito:**
   - **User Pool (`ESSENTIALS`):** Directorio de identidades con atributos de correo y grupos (`lectores`, `editores`).
   - **Hosted UI:** Interfaz de inicio de sesión gestionada con soporte PKCE.
   - **Resource Server:** Identificador `productos` con scopes de grano fino `read` y `write`.
   - **Trigger Pre-Token Generation V2 (`user-token-ms`):** Función Lambda que intercepta la emisión del token y transforma los grupos del usuario en scopes de acceso (`scopesToAdd`).
2. **API Manager — Amazon API Gateway (HTTP API v2):**
   - **JWT Authorizer:** Valida la firma criptográfica (JWKS), emisor (`iss`), expiración y audiencia (`aud` / `client_id`).
   - **Scope Guard:** Autorización a nivel de ruta:
     - `GET /datos`: Requiere scope `openid`.
     - `GET /productos` y `GET /productos/{id}`: Requieren scope `productos/read`.
     - `POST /productos`, `PUT /productos/{id}`, `DELETE /productos/{id}`: Requieren scope `productos/write`.
     - `GET /publico/datos`: Ruta pública de comparación (sin autorizador).
3. **Backend Microservicio — Spring Boot (Java 21):**
   - Contenedor Docker desplegado sobre **AWS ECS Fargate** (`linux/amd64`).
   - Expone endpoints REST en el puerto 8080 y verificación de salud en `/actuator/health`.
   - Libre de lógica de autenticación propietaria: delega la seguridad en el API Gateway.
4. **Frontend SPA — React + Vite:**
   - Alojado en **AWS Amplify Hosting**.
   - Implementa flujo Authorization Code con PKCE manual (`auth.js` y `pkce.js`).
   - Visualizador en vivo de claims decodificados (ID Token vs Access Token) y consola interactiva de pruebas de seguridad.

---

## 2. Estructura del Repositorio

```
/
├── .github/workflows/          # Pipelines de CI/CD para compilación y despliegue
│   ├── backend_compile.yml     # Maven package (Java 21)
│   ├── backend_deploy.yml      # Build Docker amd64, push a ECR y deploy a ECS Fargate
│   ├── frontend_compile.yml    # npm ci + npm run build
│   ├── frontend_deploy.yml     # Despliegue estático en AWS Amplify
│   └── user_token_ms_deploy.yml# Pruebas (node --test) y deploy del Lambda V2
├── backend/                    # Microservicio Spring Boot (Java 21)
│   ├── src/                    # Controladores (/productos, /datos) y modelos
│   ├── Dockerfile              # Construcción optimizada para ECS Fargate (amd64)
│   ├── mvnw / mvnw.cmd         # Maven Wrapper
│   └── pom.xml                 # Dependencias (Spring Boot 3.3, Actuator, Web)
├── frontend/                   # Aplicación Web SPA (React + Vite)
│   ├── public/                 # Contenedor estático para config.json generado en runtime
│   ├── src/                    # auth.js (PKCE), api.js (HTTP Client), App.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js          # Puerto estricto 5173
├── terraform/                  # Infraestructura como Código (AWS)
│   ├── versions.tf             # Proveedor AWS (~> 5.100) y tags del estudiante
│   ├── variables.tf            # Variables parametrizables (región, estudiante, LabRole)
│   ├── cognito.tf              # User Pool, Hosted UI, Resource Server, Groups, SPA Client
│   ├── apigateway.tf           # HTTP API, JWT Authorizer, Rutas con Scopes, CORS
│   ├── amplify.tf              # Hosting WEB en Amplify con regla de reescritura SPA
│   ├── ecs.tf                  # ECR, Cluster ECS, Task Definition y Fargate Service
│   ├── lambda.tf               # Lambda user-token-ms y permiso para Cognito
│   └── outputs.tf              # Endpoints, IDs de cliente y configuración de entorno
├── user-token-ms/              # Lambda Pre-Token Generation V2
│   ├── index.mjs               # Inyección dinámica de scopesToAdd
│   └── test/index.test.mjs     # Pruebas unitarias nativas (node --test)
├── scripts/                    # Scripts de automatización del ciclo de vida
│   ├── config-frontend.sh      # Genera public/config.json a partir de outputs
│   ├── publicar-amplify.sh     # Empaqueta y sube build a Amplify
│   └── publicar-ecs.sh         # Compila JAR, sube a ECR y reapunta API Gateway
├── VERIFICACION_REPOSITORIO_EA1.md # Manual oficial de verificación y checklist
├── .gitignore                  # Exclusiones estrictas de seguridad (tfstate, env, binarios)
└── README.md                   # Documentación general
```

---

## 3. Matriz de Pruebas de Seguridad y Comprobación

| Escenario | Método y Endpoint | Token / Rol | Código HTTP | Diagnóstico Técnico |
| :--- | :--- | :--- | :--- | :--- |
| **1. Sin Token** | `GET /productos` | Ninguno | `401 Unauthorized` | API Gateway Authorizer rechaza antes de llegar al backend |
| **2. Endpoint Público** | `GET /publico/datos` | Ninguno | `200 OK` | Ruta sin autorizador configurado (contraste) |
| **3. Lector Consulta** | `GET /productos` | Grupo `lectores` | `200 OK` | Token contiene scope `productos/read` |
| **4. Lector Intenta Crear** | `POST /productos` | Grupo `lectores` | `403 Forbidden` | API Gateway Scope Guard bloquea por falta de `productos/write` |
| **5. Editor Crea** | `POST /productos` | Grupo `editores` | `201 Created` | Token contiene scope `productos/write` inyectado por el Lambda |
| **6. Indicadores Protegidos**| `GET /datos` | Cualquier autenticado | `200 OK` | Token contiene scope base `openid` |

---

## 4. Guía de Ejecución Local y Despliegue

### 4.1. Despliegue de Infraestructura con Terraform
```bash
cd terraform
terraform init
terraform apply -auto-approve

# Generar variables de entorno para el frontend local:
terraform output -raw frontend_env > ../frontend/.env
```

### 4.2. Ejecución del Frontend en Local
```bash
cd frontend
npm ci
npm run dev
```
Abre en el navegador: `http://localhost:5173`

> **Credenciales de prueba inicial:**
> - Usuario: `alumno@duocuc.cl`
> - Contraseña: `CloudNative2024`
> - Rol asignado por defecto: `lectores`

### 4.3. Pruebas Unitarias del Microservicio Lambda
```bash
cd user-token-ms
node --test
```

### 4.4. Compilación del Backend Spring Boot
```bash
cd backend
./mvnw clean package -DskipTests
```

---

## 5. Configuración de Secretos en GitHub Actions

Para los despliegues automatizados en AWS Academy Learner Lab, configura los siguientes secretos en el repositorio (`Settings -> Secrets and variables -> Actions`):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

*(Recuerda renovar estos valores al iniciar cada sesión del laboratorio).*
