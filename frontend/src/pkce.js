// PKCE — RFC 7636. Es el paso 2 del diagrama de Auth0: "SDK genera un
// code_verifier criptográficamente aleatorio y deriva de él un code_challenge".
//
// El problema que resuelve: nuestro front es un cliente público (su código vive
// entero en el navegador), así que no puede guardar un client_secret. Sin
// secreto, cualquiera que intercepte el "code" del redirect podría canjearlo
// por tokens. PKCE arregla eso: la app inventa un secreto NUEVO en cada login,
// manda solo su hash al autorizar, y revela el original al canjear el code.
// Quien robe el code no tiene el verifier, y el canje le falla.

// base64url = base64 estándar pero sin "+", "/" ni "=", porque el valor viaja
// dentro de una URL.
function base64url(bytes) {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Cadena aleatoria segura. 32 bytes -> 43 caracteres base64url, que es
// justamente el mínimo que exige la RFC (el máximo es 128).
export function randomString(bytes = 32) {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return base64url(buffer)
}

// code_challenge = BASE64URL(SHA-256(code_verifier)).
// El método "plain" (mandar el verifier tal cual) también existe en la RFC,
// pero no protege de nada si alguien puede leer la URL. Usamos S256 siempre.
export async function challengeFromVerifier(verifier) {
  const datos = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', datos)
  return base64url(new Uint8Array(hash))
}
