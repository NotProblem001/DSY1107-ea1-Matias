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
      return 'HTTP 200 OK: La petición fue autorizada por el Scope Guard de API Gateway y procesada exitosamente por el microservicio Spring Boot.'
    case 201:
      return 'HTTP 201 Created: El pedido fue creado satisfactoriamente en la base de datos cloud con permisos de escritura (pedidos/write).'
    case 204:
      return 'HTTP 204 No Content: El recurso fue eliminado satisfactoriamente de la base de datos.'
    case 401:
      return 'HTTP 401 Unauthorized: El autorizador JWT de API Gateway rechazó la petición en el perímetro por token ausente, firma inválida o sesión expirada.'
    case 403:
      return 'HTTP 403 Forbidden: API Gateway Scope Guard bloqueó la petición en el perímetro porque el Access Token no posee el scope requerido (ej: lector intentando escribir).'
    case 404:
      return 'HTTP 404 Not Found: El recurso solicitado no existe en la base de datos.'
    case 500:
    case 502:
      return `HTTP ${status}: Error interno o falla de conexión hacia el backend en ECS Fargate.`
    default:
      return `Código de respuesta HTTP ${status}`
  }
}

// 1. Endpoint público de contraste (sin token requerido)
export async function obtenerDatosPublicos() {
  return realizarPeticion('/publico/datos', { method: 'GET' })
}

// 2. Endpoint protegido con scope openid
export async function obtenerDatosProtegidos(accessToken) {
  return realizarPeticion('/datos', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 3. Listar pedidos (requiere scope: pedidos/read)
export async function obtenerPedidos(accessToken) {
  return realizarPeticion('/pedidos', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 4. Obtener pedido por ID (requiere scope: pedidos/read)
export async function obtenerPedidoPorId(accessToken, id) {
  return realizarPeticion(`/pedidos/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 5. Crear pedido (requiere scope: pedidos/write)
export async function crearPedido(accessToken, pedido) {
  return realizarPeticion('/pedidos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pedido),
  })
}

// 6. Modificar pedido (requiere scope: pedidos/write)
export async function actualizarPedido(accessToken, id, pedido) {
  return realizarPeticion(`/pedidos/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pedido),
  })
}

// 7. Eliminar pedido (requiere scope: pedidos/write)
export async function eliminarPedido(accessToken, id) {
  return realizarPeticion(`/pedidos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 8. Prueba directa sin credenciales (debe devolver 401 Unauthorized en rutas protegidas)
export async function probarSinToken(ruta = '/pedidos', metodo = 'GET') {
  return realizarPeticion(ruta, { method: metodo })
}

// Alias de compatibilidad
export async function obtenerInfoPublica() {
  return obtenerDatosPublicos()
}

export async function obtenerSolicitudes(accessToken) {
  return obtenerPedidos(accessToken)
}
