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

// 1. Endpoint público de contraste e información del sistema (sin token)
export async function obtenerInfoPublica() {
  return realizarPeticion('/publico/info', { method: 'GET' })
}

// 2. Consulta de solicitudes (requiere scope: solicitudes/read)
export async function obtenerSolicitudes(accessToken, solicitanteEmail = null) {
  const query = solicitanteEmail ? `?solicitante=${encodeURIComponent(solicitanteEmail)}` : ''
  return realizarPeticion(`/solicitudes${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 3. Crear solicitud de vacaciones (requiere scope: solicitudes/write)
export async function crearSolicitud(accessToken, solicitud) {
  return realizarPeticion('/solicitudes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(solicitud),
  })
}

// 4. Modificar solicitud de vacaciones (requiere scope: solicitudes/write)
export async function actualizarSolicitud(accessToken, id, solicitud) {
  return realizarPeticion(`/solicitudes/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(solicitud),
  })
}

// 5. Eliminar solicitud de vacaciones (requiere scope: solicitudes/write)
export async function eliminarSolicitud(accessToken, id) {
  return realizarPeticion(`/solicitudes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// 6. Aprobar solicitud (requiere scope: solicitudes/approve)
export async function aprobarSolicitud(accessToken, id, { comentario, aprobadorEmail } = {}) {
  return realizarPeticion(`/solicitudes/${id}/aprobar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comentario: comentario || 'Aprobado según disponibilidad del equipo.',
      aprobadorEmail: aprobadorEmail || 'aprobador@duocuc.cl',
    }),
  })
}

// 7. Rechazar solicitud (requiere scope: solicitudes/approve)
export async function rechazarSolicitud(accessToken, id, { comentario, aprobadorEmail } = {}) {
  return realizarPeticion(`/solicitudes/${id}/rechazar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comentario: comentario || 'Rechazado por tope de fechas con otros miembros.',
      aprobadorEmail: aprobadorEmail || 'aprobador@duocuc.cl',
    }),
  })
}

// 8. Prueba directa sin credenciales (debe devolver 401 Unauthorized en rutas protegidas)
export async function probarSinToken(ruta = '/solicitudes', metodo = 'GET') {
  return realizarPeticion(ruta, { method: metodo })
}

// Métodos retrocompatibles
export async function obtenerDatosPublicos() {
  return obtenerInfoPublica()
}

export async function obtenerDatos(accessToken) {
  return obtenerSolicitudes(accessToken)
}

export async function obtenerProductos(accessToken) {
  return obtenerSolicitudes(accessToken)
}

export async function crearProducto(accessToken, producto) {
  return crearSolicitud(accessToken, {
    solicitanteEmail: 'demo@duocuc.cl',
    fechaInicio: '2026-03-01',
    fechaFin: '2026-03-10',
    dias: 10,
    motivo: producto?.nombre || 'Vacaciones',
  })
}
