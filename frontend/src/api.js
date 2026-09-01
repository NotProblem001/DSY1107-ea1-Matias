// Pasos 10-11 del diagrama: la aplicación usa el access token para llamar a la
// API, y la API responde con los datos. El token viaja en la cabecera
// Authorization con el esquema "Bearer".

const API_BASE = import.meta.env.VITE_API_BASE

export async function obtenerDatos(accessToken) {
  if (!API_BASE) {
    throw new Error('Falta VITE_API_BASE en el archivo .env')
  }

  const respuesta = await fetch(`${API_BASE}/datos`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  // 401 lo devuelve el authorizer JWT de API Gateway, no el backend: significa
  // que el token falta, expiró, o su firma/emisor/audiencia no cuadran. Es la
  // prueba de que la API está realmente protegida.
  if (respuesta.status === 401) {
    throw new Error(
      'La API rechazó el token (401). Suele ser porque expiró: ' +
        'usa "Refrescar token" o vuelve a iniciar sesión.'
    )
  }
  if (!respuesta.ok) {
    throw new Error(`La API respondió ${respuesta.status}`)
  }
  return respuesta.json()
}
