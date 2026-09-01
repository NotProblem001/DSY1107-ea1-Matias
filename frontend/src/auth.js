// Authorization Code Flow with PKCE contra Cognito, implementado a mano.
// Cada función está anotada con el paso equivalente del diagrama de Auth0
// (https://auth0.com/docs/get-started/authentication-and-authorization-flow/
//  authorization-code-flow-with-pkce). Cognito es un servidor OAuth 2.0 /
// OIDC estándar, así que el flujo es idéntico: solo cambian las URLs.

import { randomString, challengeFromVerifier } from './pkce.js'

export const config = {
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_REDIRECT_URI,
  scopes: ['openid', 'email', 'profile'],
}

// Endpoints del servidor de autorización de Cognito.
const endpoints = {
  authorize: () => `${config.domain}/oauth2/authorize`,
  token: () => `${config.domain}/oauth2/token`,
  logout: () => `${config.domain}/logout`,
}

// Guardamos verifier y state en sessionStorage porque tienen que sobrevivir a
// la redirección completa al Hosted UI y de vuelta. sessionStorage muere al
// cerrar la pestaña, que para este caso es lo correcto.
const CLAVE_VERIFIER = 'pkce_code_verifier'
const CLAVE_STATE = 'oauth_state'
const CLAVE_TOKENS = 'oauth_tokens'

// ---------------------------------------------------------------- pasos 1-3
// El usuario pulsa "Iniciar sesión". Generamos el par verifier/challenge,
// un "state" anti-CSRF, y redirigimos al servidor de autorización.
export async function login() {
  const verifier = randomString()
  const challenge = await challengeFromVerifier(verifier)
  const state = randomString(16)

  sessionStorage.setItem(CLAVE_VERIFIER, verifier)
  sessionStorage.setItem(CLAVE_STATE, state)

  const params = new URLSearchParams({
    response_type: 'code', // pedimos un CODE, no un token: eso es "code flow"
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state, // vuelve intacto en el callback; si no coincide, es un ataque
    code_challenge: challenge, // solo viaja el HASH, nunca el verifier
    code_challenge_method: 'S256',
  })

  // Redirección completa del navegador (pasos 4-5: login y consentimiento
  // ocurren en el dominio de Cognito, nuestra app no ve la contraseña jamás).
  window.location.assign(`${endpoints.authorize()}?${params}`)
}

// ---------------------------------------------------------------- pasos 6-9
// Cognito nos devuelve a redirect_uri con ?code=...&state=... . Canjeamos ese
// code por tokens, adjuntando el code_verifier original. El servidor calcula
// SHA-256(verifier) y lo compara con el challenge que guardó en el paso 6.
export async function handleRedirectCallback() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    const detalle = url.searchParams.get('error_description')
    limpiarUrl()
    throw new Error(`${error}: ${detalle ?? 'sin detalle'}`)
  }
  if (!code) return null // no venimos de un callback, no hay nada que hacer

  const stateEsperado = sessionStorage.getItem(CLAVE_STATE)
  const verifier = sessionStorage.getItem(CLAVE_VERIFIER)

  // Validación anti-CSRF: sin esto, un atacante podría inyectarnos SU code.
  if (!stateEsperado || state !== stateEsperado) {
    limpiarUrl()
    throw new Error('El parámetro "state" no coincide. Se aborta el login.')
  }
  if (!verifier) {
    limpiarUrl()
    throw new Error('No se encontró el code_verifier en esta sesión.')
  }

  const cuerpo = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId, // sin client_secret: somos cliente público
    code,
    redirect_uri: config.redirectUri, // debe ser IDÉNTICO al del paso 3
    code_verifier: verifier, // aquí se revela el secreto original
  })

  const respuesta = await fetch(endpoints.token(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  })

  // Siempre limpiamos: el code es de un solo uso y no debe quedar en el
  // historial del navegador ni en la barra de direcciones.
  sessionStorage.removeItem(CLAVE_VERIFIER)
  sessionStorage.removeItem(CLAVE_STATE)
  limpiarUrl()

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    throw new Error(`El canje del code falló (${respuesta.status}): ${detalle}`)
  }

  const tokens = await respuesta.json()
  return guardarTokens(tokens)
}

// Renovar el access token sin volver a molestar al usuario.
export async function refresh(refreshToken) {
  const cuerpo = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  })

  const respuesta = await fetch(endpoints.token(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  })
  if (!respuesta.ok) {
    throw new Error(`No se pudo refrescar (${respuesta.status})`)
  }

  // Ojo: la respuesta del refresh NO trae un refresh_token nuevo. Hay que
  // conservar el que ya teníamos o se pierde la sesión.
  const tokens = await respuesta.json()
  return guardarTokens({ ...tokens, refresh_token: refreshToken })
}

export function logout() {
  sessionStorage.removeItem(CLAVE_TOKENS)
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.redirectUri, // debe estar en logout_urls del Terraform
  })
  // Cierra también la sesión EN Cognito. Si solo borráramos los tokens
  // locales, el siguiente login entraría solo, sin pedir credenciales.
  window.location.assign(`${endpoints.logout()}?${params}`)
}

// ------------------------------------------------------------------ helpers

export function guardarTokens(tokens) {
  const conVencimiento = {
    ...tokens,
    expires_at: Date.now() + (tokens.expires_in ?? 0) * 1000,
  }
  sessionStorage.setItem(CLAVE_TOKENS, JSON.stringify(conVencimiento))
  return conVencimiento
}

export function leerTokens() {
  const crudo = sessionStorage.getItem(CLAVE_TOKENS)
  if (!crudo) return null
  try {
    return JSON.parse(crudo)
  } catch {
    return null
  }
}

export function tokenVencido(tokens) {
  if (!tokens?.expires_at) return true
  return Date.now() >= tokens.expires_at
}

// Decodifica el payload de un JWT para MOSTRARLO. Esto NO valida la firma:
// el front puede leer el token, pero quien debe verificarlo es la API.
export function decodificarJwt(jwt) {
  if (!jwt) return null
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const binario = atob(base64)
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function limpiarUrl() {
  window.history.replaceState({}, document.title, window.location.pathname)
}

export function configIncompleta() {
  const faltantes = []
  if (!config.domain) faltantes.push('VITE_COGNITO_DOMAIN')
  if (!config.clientId) faltantes.push('VITE_COGNITO_CLIENT_ID')
  if (!config.redirectUri) faltantes.push('VITE_REDIRECT_URI')
  return faltantes
}
