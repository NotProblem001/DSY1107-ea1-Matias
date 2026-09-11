# Pedidos360 · DSY1107 Experiencia de Aprendizaje 1 (RA1)
> **Diseño y Despliegue de Solución Cloud Native: Sistema de Gestión de Pedidos con API Manager (AWS API Gateway HTTP v2) e Identity as a Service (Amazon Cognito + Lambda Pre-Token Generation V2)**

Repositorio oficial para la **EA1** de la asignatura **Desarrollo Cloud Native I (DSY1107)**. Implementa una arquitectura perimetral desacoplada de extremo a extremo que gestiona, autentica, filtra y securitiza el consumo de APIs a través de estándares abiertos (**OAuth 2.0**, **OpenID Connect**, **PKCE**, **Cognito Scopes**, **JWT Authorizer** y **Spring Boot 3.3.4 con Java 21**).

---

## 1. Arquitectura de la Solución (Seguridad Perimetral RA1)

```
       ┌───────────────────────────────┐
       │     Cliente SPA (React)       │
       │    http://localhost:5173      │
       │  o AWS Amplify Hosting (Web)  │
       └──────────────┬────────────────┘
                      │
       1. OAuth2 Code Flow + PKCE (S256)
                      │
                      ▼
       ┌───────────────────────────────┐
       │      Amazon Cognito IDaaS     │
       │   User Pool (Tier ESSENTIALS) │
       │  Resource Server: "pedidos"   │
       │  Grupos: lectores / clientes  │
       │   editores / administradores  │
       └──────────────┬────────────────┘
                      │
       2. Invoca Trigger Pre-Token V2
                      ▼
       ┌───────────────────────────────┐
       │    user-token-ms (Lambda)     │
       │ Inyecta scopes dinámicamente: │
       │  - lectores -> pedidos/read   │
       │  - admin -> read + write      │
       └──────────────┬────────────────┘
                      │
       3. Retorna Access Token con claim 'scope'
                      │
                      ▼
       ┌──────────────────────────────────────────────────┐
       │     AWS API Gateway (HTTP API v2 - Perímetro)    │
       │  - JWT Authorizer (Valida JWKS + Issuer + Aud)   │
       │  - Scope Guards:                                 │
       │      * GET  /publico/datos -> Libre (200 OK)     │
       │      * GET  /datos         -> scope: openid      │
       │      * GET  /pedidos       -> scope: pedidos/read│
       │      * POST /pedidos       -> scope:pedidos/write│
       └──────────────────────┬───────────────────────────┘
                              │
               4. Reenvío por HTTP Proxy
                              ▼
       ┌──────────────────────────────────────────────────┐
       │        Backend Microservicio (Spring Boot)       │
       │  - Java 21 LTS / Spring Boot 3.3.4               │
       │  - OAuth2 Resource Server (Defensa en profundidad│
       │  - Spring Data JPA (PostgreSQL / H2 in-memory)   │
       │  - ECS Fargate (linux/amd64) en puerto 8080      │
       └──────────────────────────────────────────────────┘
```

### Componentes Clave:

1. **Identity as a Service (IDaaS) — Amazon Cognito:**
   - **User Pool (`ESSENTIALS`):** Directorio de usuarios con inicio de sesión por correo y Hosted UI (`managed_login_version = 1`).
   - **Resource Server (`pedidos`):**
     * `pedidos/read`: Consultar pedidos.
     * `pedidos/write`: Crear y modificar pedidos.
   - **Grupos de Usuarios:**
     * `lectores` / `clientes`: Acceso de solo lectura (`pedidos/read`).
     * `editores` / `administradores`: Acceso total de lectura y escritura (`pedidos/read`, `pedidos/write`).
   - **Microservicio Lambda Pre-Token Generation V2 (`user-token-ms`):**
     * Inyecta dinámicamente los scopes en `claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd`.
   - **Regla de Seguridad RA1:** Los scopes de negocio `pedidos/*` **NO** están configurados en el cliente de la SPA en Cognito para evitar que el frontend se auto-conceda scopes sin pasar por el trigger.

2. **Perímetro de Seguridad — AWS API Gateway (HTTP API v2 - Scope Guard):**
   - **JWT Authorizer:** Valida asimétricamente contra el JWKS del User Pool, verificando emisor (`issuer`) y audiencia (`client_id`).
   - **CORS Estricto:** Habilitado para `http://localhost:5173` y la URL pública de Amplify (sin barra final), permitiendo métodos `GET, POST, PUT, DELETE, OPTIONS`.
   - **Scope Guard Perimetral:**
     * `GET /publico/datos`: Ruta pública de contraste (sin autorizador).
     * `GET /datos`: Protegido con scope `openid`.
     * `GET /pedidos` y `GET /pedidos/{proxy+}`: Protegidos con scope `pedidos/read`.
     * `POST /pedidos`, `PUT /pedidos/{proxy+}`, `DELETE /pedidos/{proxy+}`: Protegidos con scope `pedidos/write`.

3. **Backend Microservicio — Spring Boot 3.3.4 (Java 21):**
   - **Persistencia Cloud:** Entidad `Pedido` (`id`, `clienteEmail`, `descripcion`, `monto`, `estado`, `fechaCreacion`) con Spring Data JPA.
   - **Conectividad:** Configurada mediante `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` (compatible con PostgreSQL / H2 in-memory).
   - **Defensa en Profundidad:** `SecurityConfig.java` valida internamente el token mediante `spring-boot-starter-oauth2-resource-server`.
   - **Endpoints REST:**
     * `GET /pedidos`: Listar pedidos.
     * `GET /pedidos/{id}`: Obtener pedido por ID.
     * `POST /pedidos`: Crear pedido (retorna `201 Created`).
     * `PUT /pedidos/{id}`: Actualizar pedido (retorna `200 OK`).
     * `DELETE /pedidos/{id}`: Eliminar pedido (retorna `204 No Content`).
     * `GET /publico/datos`: Ruta pública de contraste.
     * `GET /datos`: Ruta protegida con indicadores del sistema.
     * `GET /actuator/health`: Endpoint de salud para Fargate.

4. **Frontend SPA — React + Vite:**
   - Flujo OAuth2 + PKCE manual en `src/auth.js` y `src/pkce.js` (S256, sin librerías externas opacas).
   - Inspector visual de JWT: ID Token (identidad) vs Access Token (scopes).
   - CRUD completo de Pedidos interactivo.
   - Consola de pruebas Scope Guard en vivo demostrando los estados HTTP 200, 201, 401 y 403.

---

## 2. Estructura del Repositorio

```
/
├── .github/workflows/
│   ├── backend_compile.yml     # Java 21 Temurin + ./mvnw clean test
│   ├── backend_deploy.yml      # Build Docker amd64, push ECR, update ECS y reapunte API Gateway
│   ├── frontend_compile.yml    # Node 22 + npm ci + npm run build (RUTA_BUILD: frontend/dist)
│   ├── frontend_deploy.yml     # Inyección config.json y publicación en AWS Amplify
│   └── user_token_ms_deploy.yml# node --test, zip, actualización Lambda y smoke test
├── backend/                    # Microservicio Spring Boot (Java 21 LTS)
│   ├── src/
│   │   ├── main/java/com/DSY1107/cloudnative/
│   │   │   ├── CloudnativeApplication.java
│   │   │   ├── config/SecurityConfig.java
│   │   │   ├── controller/DatosController.java
│   │   │   ├── controller/PedidosController.java
│   │   │   ├── model/Pedido.java
│   │   │   └── repository/PedidoRepository.java
│   │   └── test/java/com/DSY1107/cloudnative/
│   │       └── CloudnativeApplicationTests.java
│   ├── Dockerfile              # Multi-stage build linux/amd64 (JDK 21 -> JRE 21)
│   ├── mvnw / mvnw.cmd         # Maven Wrapper
│   └── pom.xml                 # Spring Boot 3.3.4, JPA, OAuth2 Resource Server, H2, PostgreSQL
├── frontend/                   # SPA React + Vite
│   ├── public/config.example.json
│   ├── src/
│   │   ├── api.js              # Cliente hacia API Gateway con diagnóstico
│   │   ├── auth.js             # Flujo PKCE, canje /token y decodificación JWT
│   │   ├── pkce.js             # Generador de verifier y challenge SHA-256
│   │   ├── App.jsx             # UI modular (CRUD, consola Scope Guard e Inspector JWT)
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js          # Puerto estricto 5173
├── terraform/                  # Infraestructura como Código (AWS Academy Learner Lab)
│   ├── versions.tf             # Provider AWS ~> 5.100 y archive ~> 2.4
│   ├── variables.tf            # Variables parametrizables
│   ├── cognito.tf              # User Pool ESSENTIALS, Resource Server pedidos, grupos y demo users
│   ├── lambda.tf               # Lambda Pre-Token V2 (LabRole dinámico)
│   ├── apigateway.tf           # HTTP API v2, JWT Authorizer y Scope Guards
│   ├── amplify.tf              # Hosting WEB con regla custom de reescritura SPA
│   ├── ecs.tf                  # ECR force_delete, ECS Cluster, Task Fargate 512/1024 y ruta 0.0.0.0/0
│   └── outputs.tf              # Outputs consolidados sin duplicidad y bloques env_frontend
├── user-token-ms/              # Lambda Pre-Token Generation V2
│   ├── index.mjs               # Inyección de pedidos/read y pedidos/write
│   └── test/index.test.mjs     # Pruebas unitarias nativas (node --test)
├── scripts/                    # Scripts de ciclo de vida
│   ├── config-frontend.sh      # Genera public/config.json
│   ├── publicar-amplify.sh     # Publica zip en AWS Amplify
│   └── publicar-ecs.sh         # Compila JAR, imagen Docker amd64 y reapunta API Gateway
├── VERIFICACION_REPOSITORIO_EA1.md # Matriz de evaluación y comandos cURL
└── README.md                   # Documentación oficial
```

---

## 3. Matriz de Seguridad y Códigos HTTP Demostrables

| Escenario | Método y Endpoint | Credenciales / Token | Código HTTP | Diagnóstico y Comportamiento |
| :---: | :--- | :--- | :---: | :--- |
| **1. Ruta Pública** | `GET /publico/datos` | Ninguno | **`200 OK`** | Acceso público sin autorizador (contraste). |
| **2. Petición Anónima** | `GET /pedidos` | Ninguno | **`401 Unauthorized`** | Rechazada en el borde por JWT Authorizer de API Gateway. |
| **3. Lectura Permitida** | `GET /pedidos` | Lector (`pedidos/read`) | **`200 OK`** | API Gateway valida scope `pedidos/read` y responde con pedidos. |
| **4. Creación Permitida** | `POST /pedidos` | Admin (`pedidos/write`)| **`201 Created`** | API Gateway valida scope `pedidos/write` y backend persiste el pedido. |
| **5. Intento Ilegal Lector**| `POST /pedidos` | Lector (solo `pedidos/read`)| **`403 Forbidden`** | **Prueba RA1:** Rechazada en el perímetro por Scope Guard (falta `pedidos/write`). |
| **6. Eliminación Permitida**| `DELETE /pedidos/{id}`| Admin (`pedidos/write`)| **`204 No Content`**| Pedido eliminado exitosamente de la base de datos. |

---

## 4. Guía de Ejecución Local y Pruebas

### 4.1. Pruebas Unitarias del Microservicio Lambda Pre-Token V2
```bash
cd user-token-ms
node --test
```
*Resultado: 6 pruebas unitarias exitosas (cobertura total de grupos y scopes).*

### 4.2. Compilación y Pruebas del Backend Spring Boot
```bash
cd backend
./mvnw clean test
```
*Resultado: 7 pruebas de integración exitosas con MockMvc (CRUD de pedidos, seguridad interna y salud).*

### 4.3. Compilación del Frontend React + Vite
```bash
cd frontend
npm ci
npm run build
```
*Resultado: Compilación limpia a `frontend/dist` sin errores sintácticos.*

### 4.4. Despliegue de Infraestructura con Terraform
```bash
cd terraform
terraform init
terraform apply -auto-approve

# Generar archivo de configuración local:
terraform output -raw frontend_env > ../frontend/.env
```

### 4.5. Ejecución del Frontend en Local
```bash
cd frontend
npm run dev
```
Abre en el navegador: `http://localhost:5173`

> **Cuentas Demo Precargadas en Cognito:**
> - **Lector / Cliente (Solo lectura `pedidos/read`):**
>   - Correo: `lector@pedidos360.com`
>   - Contraseña: `Pedidos360!`
> - **Editor / Administrador (Lectura y escritura `pedidos/read`, `pedidos/write`):**
>   - Correo: `admin@pedidos360.com`
>   - Contraseña: `Pedidos360!`

---

## 5. Verificación con Comandos cURL

Revisa la guía completa con ejemplos paso a paso en [VERIFICACION_REPOSITORIO_EA1.md](file:///c:/Workspace/DSY1107-ea1-Matias/VERIFICACION_REPOSITORIO_EA1.md).
