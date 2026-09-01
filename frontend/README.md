# Front DSY1107 — Authorization Code Flow with PKCE

SPA en React + Vite que implementa el flujo descrito en
[la documentación de Auth0](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce),
usando **Amazon Cognito** como servidor de autorización.

El flujo está escrito a mano (sin librerías de auth) para que cada paso del
diagrama sea visible en el código.

## Por qué PKCE y no el Authorization Code "clásico"

El flujo clásico exige un `client_secret` al canjear el code. Un SPA no puede
guardar secretos: su JavaScript se descarga completo en el navegador y
cualquiera lo lee. Sin secreto, quien intercepte el `code` del redirect podría
canjearlo por tokens.

PKCE reemplaza el secreto fijo por uno **efímero, distinto en cada login**:

1. La app inventa un `code_verifier` aleatorio y se lo guarda.
2. Al pedir autorización manda solo `SHA-256(code_verifier)` — el `code_challenge`.
3. Al canjear el code revela el `code_verifier` original.
4. El servidor recalcula el hash y compara. Si no cuadra, no hay tokens.

Un atacante que robe el `code` no tiene el `code_verifier`, así que el canje
le falla.

## Mapa: pasos del diagrama → código

| # | Paso del diagrama | Dónde está |
|---|---|---|
| 1 | El usuario inicia el login | Botón "Iniciar sesión" en `src/App.jsx` |
| 2 | Se genera `code_verifier` y se deriva `code_challenge` | `src/pkce.js` |
| 3 | Redirección a `/authorize` con el `code_challenge` | `login()` en `src/auth.js` |
| 4-5 | Login y consentimiento del usuario | Hosted UI de Cognito (fuera de la app) |
| 6 | El servidor guarda el challenge y devuelve el `code` | Vuelve como `?code=` en la URL |
| 7 | Se envía `code` + `code_verifier` a `/oauth2/token` | `handleRedirectCallback()` en `src/auth.js` |
| 8 | El servidor verifica challenge contra verifier | Lado Cognito |
| 9 | Responde con ID token, access token y refresh token | Se guardan en `sessionStorage` |
| 10 | La app llama a la API con el access token | `src/api.js` |
| 11 | La API responde con los datos | Se muestran en pantalla |

La validación del paso 11 la hace el **authorizer JWT** de API Gateway
(`aws_apigatewayv2_authorizer.cognito` en `main.tf`): comprueba firma, emisor,
audiencia y expiración contra las claves públicas del user pool antes de dejar
pasar la petición. Sin token válido, `/datos` responde `401`.

Para comprobar que la protección funciona de verdad, llama sin token:

```bash
curl -i https://<tu-api>.execute-api.us-east-1.amazonaws.com/datos
```

Debe responder `401 Unauthorized`. Antes del authorizer devolvía `200`.

## Puesta en marcha

Primero aplica el Terraform de la carpeta padre y genera el `.env`:

```bash
terraform apply
```

```bash
terraform output -raw frontend_env > frontend/.env
```

Luego instala y levanta:

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:5173>.

El user pool tiene `allow_admin_create_user_only = true`, así que no hay
auto-registro: los usuarios los crea un administrador. El `terraform apply` ya
crea uno de prueba (`aws_cognito_user.demo` en `cognito.tf`), listo para entrar
sin pasos manuales.

Ese recurso usa `password` y no `temporary_password`, que es la diferencia
clave: con `temporary_password` el usuario quedaría en estado
`FORCE_CHANGE_PASSWORD` y el Hosted UI obligaría a cambiar la clave antes de
completar el flujo, cortando el login a medio camino. Con `password` queda
`CONFIRMED` y entra directo.

Para añadir más usuarios a mano:

```bash
aws cognito-idp admin-create-user --user-pool-id <POOL_ID> --username tu@correo.cl --user-attributes Name=email,Value=tu@correo.cl Name=email_verified,Value=true --message-action SUPPRESS
```

## Detalles que suelen romper esto

- **`redirect_uri` debe coincidir carácter por carácter** con `callback_urls`
  del Terraform, incluida la barra final. Por eso `vite.config.js` usa
  `strictPort: true`: si Vite saltara al 5174, el `redirect_uri` cambiaría y
  Cognito rechazaría la petición.
- **El `code` es de un solo uso.** React 18 en modo desarrollo monta los
  componentes dos veces, así que el efecto que canjea el code correría dos
  veces y el segundo intento fallaría con `invalid_grant`. `App.jsx` lo evita
  con un guard a nivel de módulo.
- **CORS.** El front vive en `localhost:5173` y la API en
  `execute-api.amazonaws.com`: son orígenes distintos. La `cors_configuration`
  del `main.tf` debe incluir la cabecera `authorization`, que es donde viaja
  el token.

## Nota de seguridad sobre el almacenamiento

Los tokens se guardan en `sessionStorage`, que es legible por cualquier
JavaScript de la página y por tanto vulnerable a XSS. Es aceptable para un
ejercicio de curso y hace visible el token para inspeccionarlo. En producción
lo habitual es mantener el access token solo en memoria y delegar la sesión a
una cookie `HttpOnly` emitida por un backend.
