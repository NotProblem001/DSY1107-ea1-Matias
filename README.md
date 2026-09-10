# DSY1107 · Experiencia de Aprendizaje 1 (RA1)
> **Diseño y Despliegue de Solución Cloud Native: Gestión de Solicitudes de Vacaciones con API Manager (API Gateway) e IDaaS (Amazon Cognito)**

Repositorio oficial para la **EA1** de la asignatura **Desarrollo Cloud Native I (DSY1107)**. Implementa una arquitectura perimetral desacoplada de extremo a extremo que gestiona, autentica, filtra y securitiza el consumo de APIs a través de estándares abiertos (OAuth 2.0, OpenID Connect, PKCE, Scopes y JWT).

---

## 1. Arquitectura de la Solución (Seguridad Perimetral RA1)

La solución garantiza el control de acceso en el perímetro de la red mediante la integración de:

1. **Identity as a Service (IDaaS) — Amazon Cognito:**
   - **User Pool (`ESSENTIALS`):** Directorio de identidades con atributos de correo y grupos (`solicitantes`, `aprobadores`).
   - **Hosted UI:** Interfaz de inicio de sesión gestionada con soporte PKCE.
   - **Resource Server (`solicitudes`):** Scopes declarados de grano fino:
     - `solicitudes/read` ("Consultar solicitudes")
     - `solicitudes/write` ("Crear, modificar y eliminar solicitudes")
     - `solicitudes/approve` ("Aprobar o rechazar solicitudes")
   - **Trigger Pre-Token Generation V2 (`user-token-ms`):** Microservicio Lambda que intercepta la emisión del token e inyecta dinámicamente los scopes en `accessTokenGeneration.scopesToAdd` según los grupos del usuario.
2. **API Manager — Amazon API Gateway (HTTP API v2 - Scope Guard):**
   - **JWT Authorizer:** Valida la firma criptográfica (JWKS), emisor (`iss`), expiración y audiencia (`aud` / `client_id`).
   - **Scope Guard Perimetral:** Autorización estricta por ruta y verbo HTTP:
     - `GET /publico/info`: Ruta pública informativa (sin autorizador).
     - `GET /solicitudes` y `GET /solicitudes/{proxy+}`: Requiere `solicitudes/read`.
     - `POST /solicitudes`, `PUT /solicitudes/{proxy+}`, `DELETE /solicitudes/{proxy+}`: Requiere `solicitudes/write`.
     - `POST /solicitudes/{id}/aprobar`: Requiere `solicitudes/approve`.
     - `POST /solicitudes/{id}/rechazar`: Requiere `solicitudes/approve`.
3. **Backend Microservicio — Spring Boot (Java 21 LTS):**
   - Contenedor Docker desplegado sobre **AWS ECS Fargate** (`linux/amd64`).
   - Expone endpoints REST en el puerto 8080 y verificación de salud en `/actuator/health`.
   - **Libre de lógica de autorización manual**: No evalúa roles ni parsea JWT en el código Java; asume que toda petición recibida fue filtrada por el Scope Guard en API Gateway.
4. **Frontend SPA — React + Vite:**
   - Alojado en **AWS Amplify Hosting**.
   - Implementa flujo Authorization Code con PKCE manual (`auth.js` y `pkce.js`).
   - Vistas funcionales para Solicitantes y Aprobadores, más consola interactiva de verificación en vivo de la matriz de seguridad.

---

## 2. Estructura del Repositorio

```
/
├── .github/workflows/          # Pipelines de CI/CD para compilación y despliegue
│   ├── backend_compile.yml     # Maven test y build (Java 21)
│   ├── backend_deploy.yml      # Build Docker amd64, push a ECR y deploy a ECS Fargate
│   ├── frontend_compile.yml    # npm ci + npm run build
│   ├── frontend_deploy.yml     # Despliegue estático en AWS Amplify
│   └── user_token_ms_deploy.yml# Pruebas (node --test) y deploy del Lambda V2
├── backend/                    # Microservicio Spring Boot (Java 21)
│   ├── src/                    # Controladores (/solicitudes, /publico/info) y modelos
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
│   ├── apigateway.tf           # HTTP API, JWT Authorizer, Rutas con Scope Guard, CORS
│   ├── amplify.tf              # Hosting WEB en Amplify con regla de reescritura SPA
│   ├── ecs.tf                  # ECR, Cluster ECS, Task Definition y Fargate Service
│   ├── lambda.tf               # Lambda user-token-ms y permiso para Cognito
│   └── outputs.tf              # Endpoints, IDs de integración y configuración de entorno
├── user-token-ms/              # Lambda Pre-Token Generation V2
│   ├── index.mjs               # Inyección dinámica de scopesToAdd (solicitantes, aprobadores)
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

## 3. Matriz de Pruebas de Seguridad y Comprobación (Scope Guard RA1)

| Escenario | Método y Endpoint | Token / Rol | Código HTTP | Diagnóstico Técnico |
| :--- | :--- | :--- | :--- | :--- |
| **1. Sin Token** | `GET /solicitudes` | Ninguno | `401 Unauthorized` | API Gateway Authorizer rechaza antes de llegar al backend |
| **2. Endpoint Público** | `GET /publico/info` | Ninguno | `200 OK` | Ruta sin autorizador configurado (contraste) |
| **3. Consulta Solicitante** | `GET /solicitudes` | Grupo `solicitantes` | `200 OK` | Token contiene scope `solicitudes/read` |
| **4. Creación Solicitante** | `POST /solicitudes` | Grupo `solicitantes` | `201 Created` | Token contiene scope `solicitudes/write` |
| **5. Intento Ilegal Solicitante** | `POST /solicitudes/1/aprobar` | Grupo `solicitantes` | `403 Forbidden` | API Gateway Scope Guard bloquea por falta de `solicitudes/approve` |
| **6. Aprobación Jefatura** | `POST /solicitudes/1/aprobar` | Grupo `aprobadores` | `200 OK` | Token contiene scope `solicitudes/approve` |
| **7. Intento Ilegal Aprobador** | `POST /solicitudes` | Grupo `aprobadores` | `403 Forbidden` | API Gateway Scope Guard bloquea por falta de `solicitudes/write` |

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

> **Cuentas de prueba precargadas:**
> - **Solicitante:** `solicitante@duocuc.cl` / `CloudNative2024` (Grupo: `solicitantes`)
> - **Aprobador:** `aprobador@duocuc.cl` / `CloudNative2024` (Grupo: `aprobadores`)

### 4.3. Pruebas Unitarias del Microservicio Lambda
```bash
cd user-token-ms
node --test
```

### 4.4. Compilación del Backend Spring Boot
```bash
cd backend
./mvnw clean test
```

---

## 5. Configuración de Secretos en GitHub Actions

Para los despliegues automatizados en AWS Academy Learner Lab, configura los siguientes secretos en el repositorio (`Settings -> Secrets and variables -> Actions`):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

*(Recuerda renovar estos valores al iniciar cada sesión del laboratorio).*
