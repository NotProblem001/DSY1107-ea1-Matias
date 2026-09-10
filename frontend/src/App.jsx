import { useEffect, useState } from 'react'
import {
  config,
  configIncompleta,
  cargarConfiguracion,
  decodificarJwt,
  handleRedirectCallback,
  leerTokens,
  login,
  logout,
  refresh,
  tokenVencido,
} from './auth.js'
import {
  obtenerDatos,
  obtenerDatosPublicos,
  obtenerProductos,
  crearProducto,
  probarSinToken,
} from './api.js'

let callbackProcesado = false

export default function App() {
  const [tokens, setTokens] = useState(() => leerTokens())
  const [error, setError] = useState(null)
  const [resultadoApi, setResultadoApi] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [configCargada, setConfigCargada] = useState(false)

  // Inicializar configuración (runtime config.json o variables de entorno)
  useEffect(() => {
    cargarConfiguracion().then(() => setConfigCargada(true))
  }, [])

  // Procesar retorno de Cognito Hosted UI con ?code=
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

  // Lista de scopes obtenidos en el access token
  const scopesTokens = accessClaims?.scope ? accessClaims.scope.split(' ') : []

  async function ejecutarAccion(nombrePrueba, peticionFn) {
    setCargando(true)
    setError(null)
    setResultadoApi(null)
    try {
      const res = await peticionFn()
      setResultadoApi({
        prueba: nombrePrueba,
        status: res.status,
        statusText: res.statusText,
        diagnostico: res.diagnostico,
        data: res.data,
      })
    } catch (err) {
      if (err.detalle) {
        setResultadoApi({
          prueba: nombrePrueba,
          status: err.detalle.status,
          statusText: err.detalle.statusText,
          diagnostico: err.detalle.diagnostico,
          data: err.detalle.data,
        })
      } else {
        setError(err.message)
      }
    } finally {
      setCargando(false)
    }
  }

  async function renovarSesion() {
    setError(null)
    try {
      const nuevos = await refresh(tokens.refresh_token)
      setTokens(nuevos)
    } catch (e) {
      setError(e.message)
    }
  }

  const faltantes = configIncompleta()
  if (configCargada && faltantes.length > 0) {
    return (
      <main>
        <h1>Configuración Incompleta</h1>
        <div className="error">
          Faltan parámetros de conexión: <strong>{faltantes.join(', ')}</strong>
        </div>
        <p>En desarrollo local, genera el archivo <code>frontend/.env</code> con:</p>
        <pre>terraform output -raw frontend_env &gt; frontend/.env</pre>
        <p>En despliegues de AWS Amplify, el script <code>scripts/config-frontend.sh</code> genera <code>public/config.json</code>.</p>
      </main>
    )
  }

  return (
    <main>
      <header>
        <h1>DSY1107 · API Manager + IDaaS (RA1)</h1>
        <p className="sub">
          Arquitectura Cloud Native · Flujo Authorization Code con PKCE · Amazon Cognito + API Gateway
        </p>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!tokens ? (
        <section>
          <h2>Iniciar Sesión con Cognito</h2>
          <p>
            No hay sesión activa. Al pulsar el botón se generará un <code>code_verifier</code> criptográfico,
            su hash SHA-256 (<code>code_challenge</code>) y se redirigirá al Hosted UI de Cognito.
          </p>
          <div className="info-box">
            <strong>Usuario demo precargado:</strong> <code>alumno@duocuc.cl</code> / <code>CloudNative2024</code> (Grupo: <code>lectores</code>)
          </div>
          <button className="primario" onClick={() => login().catch((e) => setError(e.message))}>
            Iniciar sesión con Hosted UI
          </button>
        </section>
      ) : (
        <>
          {/* Panel de Sesión y Claims */}
          <section>
            <h2>Sesión Activa</h2>
            <dl>
              <dt>Usuario Autenticado</dt>
              <dd><strong>{idClaims?.email ?? idClaims?.['cognito:username'] ?? '—'}</strong></dd>

              <dt>Grupos Cognito</dt>
              <dd className="mono">{idClaims?.['cognito:groups']?.join(', ') || '(sin grupo)'}</dd>

              <dt>Scopes del Access Token</dt>
              <dd>
                {scopesTokens.map((s) => (
                  <span
                    key={s}
                    className={`badge badge-scope ${s.startsWith('productos') ? 'destacado' : ''}`}
                  >
                    {s}
                  </span>
                ))}
              </dd>

              <dt>Estado del Token</dt>
              <dd>
                {vencido ? (
                  <span className="vencido">Expirado</span>
                ) : (
                  <span className="vigente">
                    Vigente hasta {new Date(tokens.expires_at).toLocaleTimeString('es-CL')}
                  </span>
                )}
              </dd>
            </dl>

            <div className="acciones">
              {tokens.refresh_token && (
                <button onClick={renovarSesion}>Refrescar Token</button>
              )}
              <button className="peligro" onClick={logout}>Cerrar Sesión (SSO)</button>
            </div>
          </section>

          {/* Matriz de Pruebas de Seguridad y Permisos */}
          <section>
            <h2>Matriz de Verificación y Demostración (RA1)</h2>
            <p className="sub" style={{ margin: '0 0 1rem' }}>
              Ejecuta cada escenario para verificar el filtrado por Authorizer y Scope Guard en API Gateway:
            </p>

            <div className="grid-pruebas">
              <div className="tarjeta-prueba">
                <div>
                  <h4>1. Petición Sin Token</h4>
                  <p><code>GET /productos</code> sin cabecera Authorization.</p>
                </div>
                <button
                  disabled={cargando}
                  onClick={() => ejecutarAccion('1. Sin Token (GET /productos)', () => probarSinToken('/productos'))}
                >
                  Probar (Esperado 401)
                </button>
              </div>

              <div className="tarjeta-prueba">
                <div>
                  <h4>2. Ruta Pública</h4>
                  <p><code>GET /publico/datos</code> sin protección para contraste.</p>
                </div>
                <button
                  disabled={cargando}
                  onClick={() => ejecutarAccion('2. Ruta Pública (/publico/datos)', () => obtenerDatosPublicos())}
                >
                  Probar (Esperado 200)
                </button>
              </div>

              <div className="tarjeta-prueba">
                <div>
                  <h4>3. Consulta Lector</h4>
                  <p><code>GET /productos</code> con scope <code>productos/read</code>.</p>
                </div>
                <button
                  className="primario"
                  disabled={cargando}
                  onClick={() => ejecutarAccion('3. Consulta Productos (GET)', () => obtenerProductos(tokens.access_token))}
                >
                  Consultar (Esperado 200)
                </button>
              </div>

              <div className="tarjeta-prueba">
                <div>
                  <h4>4. Escritura / Creación</h4>
                  <p><code>POST /productos</code> requiere scope <code>productos/write</code>.</p>
                </div>
                <button
                  disabled={cargando}
                  onClick={() =>
                    ejecutarAccion('4. Crear Producto (POST)', () =>
                      crearProducto(tokens.access_token, {
                        nombre: 'Monitor Gamer 165Hz',
                        precio: 199990.0,
                        categoria: 'Pantallas',
                      })
                    )
                  }
                >
                  Crear (403 Lector / 201 Editor)
                </button>
              </div>

              <div className="tarjeta-prueba">
                <div>
                  <h4>5. Indicadores /datos</h4>
                  <p><code>GET /datos</code> protegido por scope <code>openid</code>.</p>
                </div>
                <button
                  disabled={cargando}
                  onClick={() => ejecutarAccion('5. Indicadores (/datos)', () => obtenerDatos(tokens.access_token))}
                >
                  Probar (Esperado 200)
                </button>
              </div>
            </div>
          </section>

          {/* Resultado de la Última Petición */}
          {resultadoApi && (
            <section>
              <h2>Resultado: {resultadoApi.prueba}</h2>
              <div style={{ margin: '0.5rem 0 1rem' }}>
                <span
                  className={`badge ${
                    resultadoApi.status >= 200 && resultadoApi.status < 300
                      ? 'badge-ok'
                      : resultadoApi.status === 403
                      ? 'badge-aviso'
                      : 'badge-mal'
                  }`}
                  style={{ fontSize: '0.9rem', padding: '0.3rem 0.7rem' }}
                >
                  HTTP {resultadoApi.status} {resultadoApi.statusText}
                </span>
                <p style={{ marginTop: '0.5rem' }}>{resultadoApi.diagnostico}</p>
              </div>

              <pre>{JSON.stringify(resultadoApi.data, null, 2)}</pre>
            </section>
          )}

          {/* Inspección Detallada de Tokens */}
          <details>
            <summary>Inspeccionar Claims Decodificados (ID Token vs Access Token)</summary>
            <h3>ID Token (Identidad del Usuario)</h3>
            <pre>{JSON.stringify(idClaims, null, 2)}</pre>

            <h3>Access Token (Autorización y Scopes de Negocio)</h3>
            <pre>{JSON.stringify(accessClaims, null, 2)}</pre>

            <h3>Tokens Crudos en Sesión</h3>
            <pre>{JSON.stringify(tokens, null, 2)}</pre>
          </details>
        </>
      )}
    </main>
  )
}
