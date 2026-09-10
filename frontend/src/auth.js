// Authorization Code Flow with PKCE contra Cognito, implementado a mano.
// Cada función está anotada con el paso equivalente del diagrama de Auth0.
// Cognito es un servidor OAuth 2.0 / OIDC estándar: solo cambian las URLs.

import { randomString, challengeFromVerifier } from './pkce.js'

let runtimeConfig = {
  domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/',
  apiUrl: import.meta.env.VITE_API_BASE || '',
  scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
}

// Permite acceso reactivo a las variables configuradas
export const config = new Proxy(runtimeConfig, {
  get(target, prop) {
    return target[prop]
  },
})

// Carga configuración dinámica generada en Amplify (public/config.json) con fallback a .env
export async function cargarConfiguracion() {
  try {
    const respuesta = await fetch('/config.json', { cache: 'no-store' })
    if (respuesta.ok) {
      const json = await respuesta.json()
      if (json.cognitoDomain) runtimeConfig.domain = json.cognitoDomain
      if (json.clientId) runtimeConfig.clientId = json.clientId
      if (json.redirectUri) runtimeConfig.redirectUri = json.redirectUri
      if (json.apiUrl) runtimeConfig.apiUrl = json.apiUrl
    }
  } catch {
    // Si falla, se conservan los valores inyectados por Vite (import.meta.env)
  }
  return runtimeConfig
}

// Endpoints del servidor de autorización de Cognito.
const endpoints = {
  authorize: () => `${config.domain}/oauth2/authorize`,
  token: () => `${config.domain}/oauth2/token`,
  logout: () => `${config.domain}/logout`,
}

const CLAVE_VERIFIER = 'pkce_code_verifier'
const CLAVE_STATE = 'oauth_state'
const CLAVE_TOKENS = 'oauth_tokens'

// Pasos 1-3: Generación de verifier y challenge PKCE + redirección a Cognito
export async function login() {
  await cargarConfiguracion()
  const verifier = randomString()
  const challenge = await challengeFromVerifier(verifier)
  const state = randomString(16)

  sessionStorage.setItem(CLAVE_VERIFIER, verifier)
  sessionStorage.setItem(CLAVE_STATE, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.assign(`${endpoints.authorize()}?${params}`)
}

// Pasos 6-9: Canje de authorization_code por tokens JWT usando el code_verifier
export async function handleRedirectCallback() {
  await cargarConfiguracion()
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    const detalle = url.searchParams.get('error_description')
    limpiarUrl()
    throw new Error(`${error}: ${detalle ?? 'sin detalle'}`)
  }
  if (!code) return null

  const stateEsperado = sessionStorage.getItem(CLAVE_STATE)
  const verifier = sessionStorage.getItem(CLAVE_VERIFIER)

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
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  })

  const respuesta = await fetch(endpoints.token(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  })

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

// Renovar el access token usando el refresh token
export async function refresh(refreshToken) {
  await cargarConfiguracion()
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

  const tokens = await respuesta.json()
  return guardarTokens({ ...tokens, refresh_token: refreshToken })
}

// Logout destruyendo sesión local y redirigiendo a Cognito /logout
export function logout() {
  sessionStorage.removeItem(CLAVE_TOKENS)
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.redirectUri,
  })
  window.location.assign(`${endpoints.logout()}?${params}`)
}

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
  if (!config.domain) faltantes.push('VITE_COGNITO_DOMAIN o cognitoDomain')
  if (!config.clientId) faltantes.push('VITE_COGNITO_CLIENT_ID o clientId')
  if (!config.redirectUri) faltantes.push('VITE_REDIRECT_URI o redirectUri')
  return faltantes
}
