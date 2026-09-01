import { useEffect, useState } from 'react'
import {
  config,
  configIncompleta,
  decodificarJwt,
  handleRedirectCallback,
  leerTokens,
  login,
  logout,
  refresh,
  tokenVencido,
} from './auth.js'
import { obtenerDatos } from './api.js'

// Guard a nivel de módulo, no useRef: en desarrollo React 18 monta el
// componente dos veces (StrictMode) y el efecto se dispararía dos veces. El
// authorization code es de UN SOLO USO, así que el segundo canje fallaría con
// "invalid_grant". Una variable de módulo sobrevive al doble montaje.
let callbackProcesado = false

export default function App() {
  const [tokens, setTokens] = useState(() => leerTokens())
  const [error, setError] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)

  const faltantes = configIncompleta()

  // Paso 6-9: si volvemos del Hosted UI con ?code=..., lo canjeamos por tokens.
  useEffect(() => {
    if (callbackProcesado) return
    callbackProcesado = true

    handleRedirectCallback()
      .then((recibidos) => {
        if (recibidos) setTokens(recibidos)
      })
      .catch((e) => setError(e.message))
  }, [])

  const idClaims = decodificarJwt(tokens?.id_token)
  const accessClaims = decodificarJwt(tokens?.access_token)
  const vencido = tokens ? tokenVencido(tokens) : false

  async function llamarApi() {
    setCargando(true)
    setError(null)
    try {
      setDatos(await obtenerDatos(tokens.access_token))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function renovar() {
    setError(null)
    try {
      setTokens(await refresh(tokens.refresh_token))
    } catch (e) {
      setError(e.message)
    }
  }

  if (faltantes.length > 0) {
    return (
      <main>
        <h1>Falta configuración</h1>
        <p>
          Crea <code>frontend/.env</code> con estas variables:{' '}
          <strong>{faltantes.join(', ')}</strong>
        </p>
        <pre>terraform output -raw frontend_env {'>'} frontend/.env</pre>
      </main>
    )
  }

  return (
    <main>
      <header>
        <h1>DSY1107 · Authorization Code + PKCE</h1>
        <p className="sub">
          Cliente público contra Cognito · <code>{new URL(config.domain).host}</code>
        </p>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!tokens ? (
        <section>
          <p>
            No hay sesión. Al pulsar el botón se genera un{' '}
            <code>code_verifier</code> nuevo, se envía su hash SHA-256 como{' '}
            <code>code_challenge</code> y el navegador viaja al Hosted UI de
            Cognito. La contraseña se escribe allá, nunca aquí.
          </p>
          <button className="primario" onClick={() => login().catch((e) => setError(e.message))}>
            Iniciar sesión
          </button>
        </section>
      ) : (
        <>
          <section>
            <h2>Sesión activa</h2>
            <dl>
              <dt>Usuario</dt>
              <dd>{idClaims?.email ?? idClaims?.['cognito:username'] ?? '—'}</dd>
              <dt>Emitido por</dt>
              <dd className="mono">{idClaims?.iss ?? '—'}</dd>
              <dt>Scopes del access token</dt>
              <dd className="mono">{accessClaims?.scope ?? '—'}</dd>
              <dt>Estado</dt>
              <dd>
                {vencido ? (
                  <span className="vencido">expirado</span>
                ) : (
                  <span className="vigente">
                    vigente hasta{' '}
                    {new Date(tokens.expires_at).toLocaleTimeString('es-CL')}
                  </span>
                )}
              </dd>
            </dl>

            <div className="acciones">
              <button className="primario" onClick={llamarApi} disabled={cargando}>
                {cargando ? 'Llamando…' : 'Llamar a /datos'}
              </button>
              {tokens.refresh_token && (
                <button onClick={renovar}>Refrescar token</button>
              )}
              <button onClick={logout}>Cerrar sesión</button>
            </div>
          </section>

          {datos && (
            <section>
              <h2>Respuesta de la API</h2>
              <pre>{JSON.stringify(datos, null, 2)}</pre>
            </section>
          )}

          <details>
            <summary>Ver tokens crudos y claims</summary>
            <h3>ID token (quién es el usuario)</h3>
            <pre>{JSON.stringify(idClaims, null, 2)}</pre>
            <h3>Access token (qué puede hacer)</h3>
            <pre>{JSON.stringify(accessClaims, null, 2)}</pre>
            <h3>Respuesta completa del endpoint /oauth2/token</h3>
            <pre>{JSON.stringify(tokens, null, 2)}</pre>
          </details>
        </>
      )}
    </main>
  )
}
