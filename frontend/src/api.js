import { config, cargarConfiguracion } from './auth.js'

async function obtenerApiBase() {
  await cargarConfiguracion()
  const base = config.apiUrl || import.meta.env.VITE_API_BASE
  if (!base) {
    throw new Error('Falta apiUrl en config.json o VITE_API_BASE en .env')
  }
  return base.replace(/\/+$/, '')
}

/**
 * Petición genérica con diagnóstico de seguridad HTTP
 */
async function realizarPeticion(ruta, opciones = {}) {
  const apiBase = await obtenerApiBase()
  const url = `${apiBase}${ruta}`

  const respuesta = await fetch(url, opciones)

  let contenido = null
  const tipoContenido = respuesta.headers.get('content-type') || ''
  if (tipoContenido.includes('application/json')) {
    try {
      contenido = await respuesta.json()
    } catch {
      contenido = null
    }
  } else {
    contenido = await respuesta.text()
  }

  const resultado = {
    status: respuesta.status,
    statusText: respuesta.statusText,
    ok: respuesta.ok,
    url,
    data: contenido,
    diagnostico: diagnosticarEstado(respuesta.status, ruta),
  }

  if (!respuesta.ok) {
    const err = new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`)
    err.detalle = resultado
    throw err
  }

  return resultado
}

function diagnosticarEstado(status, ruta) {
  switch (status) {
    case 200:
    case 201:
      return 'OK: La petición fue autorizada y procesada exitosamente por el backend.'
    case 401:
      return '401 Unauthorized: El autorizador JWT de API Gateway rechazó la petición por token ausente, inválido o vencido.'
    case 403:
      return '403 Forbidden: API Gateway Scope Guard bloqueó la petición porque el access token no posee el scope requerido.'
    case 404:
      return '404 Not Found: El recurso solicitado no existe en el backend.'
    case 500:
    case 502:
      return `HTTP ${status}: Error interno o falla de conexión hacia el backend en ECS Fargate.`
    default:
      return `Código de respuesta HTTP ${status}`
  }
}

// 1. Endpoint público para prueba de contraste
export async function obtenerDatosPublicos() {
  return realizarPeticion('/publico/datos', { method: 'GET' })
}

// 2. Endpoint protegido /datos (requiere openid)
export async function obtenerDatos(accessToken) {
  return realizarPeticion('/datos', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 3. Endpoint protegido /productos - Lectura (requiere productos/read)
export async function obtenerProductos(accessToken) {
  return realizarPeticion('/productos', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 4. Endpoint protegido /productos - Escritura (requiere productos/write)
export async function crearProducto(accessToken, producto) {
  return realizarPeticion('/productos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(producto),
  })
}

// 5. Prueba directa sin credenciales (debe devolver 401 en rutas protegidas)
export async function probarSinToken(ruta = '/productos') {
  return realizarPeticion(ruta, { method: 'GET' })
}
