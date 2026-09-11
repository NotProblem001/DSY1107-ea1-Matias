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
  obtenerDatosPublicos,
  obtenerDatosProtegidos,
  obtenerPedidos,
  crearPedido,
  actualizarPedido,
  eliminarPedido,
  probarSinToken,
} from './api.js'

let callbackProcesado = false

export default function App() {
  const [tokens, setTokens] = useState(() => leerTokens())
  const [error, setError] = useState(null)
  const [resultadoApi, setResultadoApi] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [configCargada, setConfigCargada] = useState(false)
  const [pestanaActiva, setPestanaActiva] = useState('pedidos') // 'pedidos', 'seguridad', 'tokens'

  // Estado de pedidos en la UI
  const [pedidos, setPedidos] = useState([])
  const [formNuevo, setFormNuevo] = useState({
    descripcion: 'Laptop Dell XPS 15 - 32GB RAM / 1TB SSD',
    monto: 1899990,
    estado: 'PENDIENTE',
  })

  // Inicializar configuración al montar
  useEffect(() => {
    cargarConfiguracion().then(() => setConfigCargada(true))
  }, [])

  // Procesar redirección con ?code= de Cognito Hosted UI
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
  const emailUsuario = idClaims?.email ?? idClaims?.['cognito:username'] ?? ''
  const gruposUsuario = idClaims?.['cognito:groups'] || []
  const scopesTokens = accessClaims?.scope ? accessClaims.scope.split(' ') : []

  // Cargar pedidos cuando haya token
  async function cargarListaPedidos() {
    if (!tokens?.access_token) return
    try {
      const res = await obtenerPedidos(tokens.access_token)
      if (Array.isArray(res.data)) {
        setPedidos(res.data)
      }
    } catch {
      // Los errores se capturan en el visor de resultados
    }
  }

  useEffect(() => {
    if (tokens?.access_token) {
      cargarListaPedidos()
    }
  }, [tokens])

  async function ejecutarAccion(nombrePrueba, peticionFn, recargar = false) {
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
      if (recargar) {
        await cargarListaPedidos()
      }
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

  async function handleCrearPedido(e) {
    e.preventDefault()
    if (!tokens?.access_token) return
    const payload = {
      clienteEmail: emailUsuario || 'cliente@pedidos360.com',
      descripcion: formNuevo.descripcion,
      monto: Number(formNuevo.monto),
      estado: formNuevo.estado || 'PENDIENTE',
    }
    await ejecutarAccion('Crear Pedido (POST /pedidos)', () => crearPedido(tokens.access_token, payload), true)
  }

  async function handleCambiarEstado(id, nuevoEstado) {
    const pedido = pedidos.find(p => p.id === id)
    if (!pedido) return
    const payload = { ...pedido, estado: nuevoEstado }
    await ejecutarAccion(`Actualizar Pedido #${id} a ${nuevoEstado} (PUT /pedidos/${id})`, () =>
      actualizarPedido(tokens.access_token, id, payload), true)
  }

  async function handleEliminar(id) {
    if (!window.confirm(`¿Deseas eliminar el pedido #${id}?`)) return
    await ejecutarAccion(`Eliminar Pedido #${id} (DELETE /pedidos/${id})`, () => eliminarPedido(tokens.access_token, id), true)
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
        <h1>Pedidos360 · Plataforma Cloud Native</h1>
        <p className="sub">
          DSY1107 (EA1 / RA1) · Seguridad Perimetral con AWS Cognito IDaaS + API Gateway Scope Guards + Spring Boot ECS Fargate
        </p>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!tokens ? (
        <section>
          <h2>Iniciar Sesión con Amazon Cognito IDaaS</h2>
          <p>
            No hay sesión activa. Al pulsar el botón se iniciará el flujo <strong>Authorization Code con PKCE</strong> mediante el Hosted UI de Cognito.
          </p>
          <div className="info-box">
            <strong>Cuentas demo precargadas para evaluación:</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              <li>
                <strong>Lector / Cliente:</strong> <code>lector@pedidos360.com</code> / <code>Pedidos360!</code> (Grupo: <code>lectores</code> &rarr; Scopes inyectados: <code>pedidos/read</code>).
              </li>
              <li>
                <strong>Editor / Administrador:</strong> <code>admin@pedidos360.com</code> / <code>Pedidos360!</code> (Grupo: <code>administradores</code> &rarr; Scopes inyectados: <code>pedidos/read</code>, <code>pedidos/write</code>).
              </li>
            </ul>
          </div>
          <div className="acciones">
            <button className="primario" onClick={() => login().catch((e) => setError(e.message))}>
              Iniciar sesión con Hosted UI
            </button>
            <button onClick={() => ejecutarAccion('Consulta Pública Sin Autenticación (/publico/datos)', () => obtenerDatosPublicos())}>
              Probar Endpoint Público (/publico/datos)
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Panel de Sesión y Claims */}
          <section>
            <h2>Sesión Activa</h2>
            <dl>
              <dt>Usuario Autenticado</dt>
              <dd><strong>{emailUsuario || '—'}</strong></dd>

              <dt>Grupo(s) Cognito</dt>
              <dd className="mono">
                {gruposUsuario.length > 0 ? (
                  gruposUsuario.map(g => (
                    <span key={g} className="badge badge-scope destacado">{g}</span>
                  ))
                ) : (
                  '(sin grupo asignado)'
                )}
              </dd>

              <dt>Scopes en Access Token</dt>
              <dd>
                {scopesTokens.map((s) => (
                  <span
                    key={s}
                    className={`badge badge-scope ${s.startsWith('pedidos') ? 'destacado' : ''}`}
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
              <button className="peligro" onClick={logout}>Cerrar Sesión SSO</button>
            </div>
          </section>

          {/* Navegación por Pestañas */}
          <div className="tabs">
            <button
              className={`tab-boton ${pestanaActiva === 'pedidos' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('pedidos')}
            >
              Gestión de Pedidos (CRUD)
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'seguridad' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('seguridad')}
            >
              Consola Scope Guard (RA1)
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'tokens' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('tokens')}
            >
              Inspector JWT
            </button>
          </div>

          {/* PESTAÑA 1: CRUD PEDIDOS */}
          {pestanaActiva === 'pedidos' && (
            <section>
              <h2>Listado de Pedidos</h2>
              <p className="sub">
                Visualización y creación de pedidos en Spring Boot Fargate vía API Gateway. Requiere scopes <code>pedidos/read</code> para lectura y <code>pedidos/write</code> para creación/modificación.
              </p>

              {/* Formulario de Nuevo Pedido */}
              <form onSubmit={handleCrearPedido} style={{ marginBottom: '1.5rem' }}>
                <h3>Registrar Nuevo Pedido</h3>
                <div className="form-grid">
                  <div className="form-campo" style={{ gridColumn: '1 / -1' }}>
                    <label>Descripción del Pedido</label>
                    <input
                      type="text"
                      placeholder="Ej: Servidor Dell PowerEdge R750"
                      value={formNuevo.descripcion}
                      onChange={(e) => setFormNuevo({ ...formNuevo, descripcion: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-campo">
                    <label>Monto (CLP)</label>
                    <input
                      type="number"
                      min="1"
                      value={formNuevo.monto}
                      onChange={(e) => setFormNuevo({ ...formNuevo, monto: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-campo">
                    <label>Estado Inicial</label>
                    <select
                      value={formNuevo.estado}
                      onChange={(e) => setFormNuevo({ ...formNuevo, estado: e.target.value })}
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="EN_PROCESO">EN_PROCESO</option>
                      <option value="COMPLETADO">COMPLETADO</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="primario" disabled={cargando}>
                  Crear Pedido (Requiere pedidos/write)
                </button>
              </form>

              {/* Tabla de Pedidos */}
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Fecha Creación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--tenue)' }}>
                          No hay pedidos registrados o pulsa 'Actualizar' para recargar.
                        </td>
                      </tr>
                    ) : (
                      pedidos.map((p) => (
                        <tr key={p.id}>
                          <td><strong>#{p.id}</strong></td>
                          <td>{p.clienteEmail}</td>
                          <td>{p.descripcion}</td>
                          <td>${Number(p.monto).toLocaleString('es-CL')}</td>
                          <td>
                            <span
                              className={`badge ${
                                p.estado === 'COMPLETADO'
                                  ? 'badge-aprobada'
                                  : p.estado === 'CANCELADO'
                                  ? 'badge-rechazada'
                                  : 'badge-pendiente'
                              }`}
                            >
                              {p.estado}
                            </span>
                          </td>
                          <td>{p.fechaCreacion ? p.fechaCreacion.substring(0, 19).replace('T', ' ') : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              {p.estado !== 'COMPLETADO' && (
                                <button
                                  disabled={cargando}
                                  onClick={() => handleCambiarEstado(p.id, 'COMPLETADO')}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--ok)' }}
                                >
                                  Completar
                                </button>
                              )}
                              <button
                                disabled={cargando}
                                onClick={() => handleEliminar(p.id)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--mal)' }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button disabled={cargando} onClick={() => ejecutarAccion('Listar Pedidos (GET /pedidos)', () => obtenerPedidos(tokens.access_token), true)}>
                  Actualizar Lista (GET /pedidos)
                </button>
              </div>
            </section>
          )}

          {/* PESTAÑA 2: CONSOLA SCOPE GUARD (RA1) */}
          {pestanaActiva === 'seguridad' && (
            <section>
              <h2>Matriz de Verificación y Scope Guard (RA1)</h2>
              <p className="sub" style={{ margin: '0 0 1rem' }}>
                Comprobación en vivo del filtrado perimetral en AWS API Gateway según la identidad y scopes del usuario:
              </p>

              <div className="grid-pruebas">
                {/* 1. Ruta Pública */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>1. Ruta Pública (/publico/datos)</h4>
                    <p><code>GET /publico/datos</code> sin autorizador en API Gateway.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('1. Ruta Pública (GET /publico/datos)', () => obtenerDatosPublicos())}
                  >
                    Probar (Esperado 200 OK)
                  </button>
                </div>

                {/* 2. Consulta de Pedidos */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>2. Lectura de Pedidos (GET /pedidos)</h4>
                    <p>Requiere scope <code>pedidos/read</code> concedido a lectores y administradores.</p>
                  </div>
                  <button
                    className="primario"
                    disabled={cargando}
                    onClick={() => ejecutarAccion('2. Lectura Pedidos (GET /pedidos)', () => obtenerPedidos(tokens.access_token))}
                  >
                    Consultar (Esperado 200 OK)
                  </button>
                </div>

                {/* 3. Creación de Pedido */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>3. Creación de Pedido (POST /pedidos)</h4>
                    <p>Requiere scope <code>pedidos/write</code>. Solo administradores/editores.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('3. Creación Pedido (POST /pedidos)', () =>
                        crearPedido(tokens.access_token, {
                          clienteEmail: emailUsuario,
                          descripcion: 'Dispositivo IoT Sensor de Temperatura Industrial',
                          monto: 145000,
                          estado: 'PENDIENTE',
                        }), true
                      )
                    }
                  >
                    Crear (201 Admin / 403 Lector)
                  </button>
                </div>

                {/* 4. Petición Sin Token */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>4. Petición Sin Token (GET /pedidos)</h4>
                    <p>Petición anónima a ruta protegida. Rechazada en el borde.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('4. Sin Token (GET /pedidos)', () => probarSinToken('/pedidos', 'GET'))}
                  >
                    Probar (Esperado 401)
                  </button>
                </div>

                {/* 5. Intento POST Sin Token */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>5. Escritura Sin Token (POST /pedidos)</h4>
                    <p>Petición POST anónima rechazada por API Gateway JWT Authorizer.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('5. POST Sin Token (POST /pedidos)', () => probarSinToken('/pedidos', 'POST'))}
                  >
                    Probar (Esperado 401)
                  </button>
                </div>

                {/* 6. Ruta Protegida con scope openid */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>6. Datos del Sistema (GET /datos)</h4>
                    <p>Requiere autenticación con scope estándar <code>openid</code>.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('6. Datos Protegidos (GET /datos)', () => obtenerDatosProtegidos(tokens.access_token))}
                  >
                    Consultar (Esperado 200 OK)
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* PESTAÑA 3: INSPECTOR JWT */}
          {pestanaActiva === 'tokens' && (
            <section>
              <h2>Inspector Visual de Tokens JWT (OIDC & OAuth 2.0)</h2>
              <p className="sub">
                Diferenciación arquitectónica entre <strong>ID Token</strong> (identidad del usuario autenticado) y <strong>Access Token</strong> (autorización y scopes de negocio inyectados por Lambda Pre-Token Generation V2).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem', marginTop: '1rem' }}>
                <div style={{ background: 'var(--tarjeta)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--borde)' }}>
                  <h3 style={{ color: 'var(--primario)', marginTop: 0 }}>ID Token (Identidad / Claims)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--tenue)' }}>Contiene datos del perfil de usuario (email, sub, grupos):</p>
                  <pre style={{ maxHeight: '350px', overflowY: 'auto' }}>{JSON.stringify(idClaims, null, 2)}</pre>
                </div>

                <div style={{ background: 'var(--tarjeta)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--borde)' }}>
                  <h3 style={{ color: 'var(--ok)', marginTop: 0 }}>Access Token (Autorización / Scopes)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--tenue)' }}>Contiene el claim <code>scope</code> evaluado por API Gateway Scope Guard:</p>
                  <pre style={{ maxHeight: '350px', overflowY: 'auto' }}>{JSON.stringify(accessClaims, null, 2)}</pre>
                </div>
              </div>

              <details style={{ marginTop: '1.5rem' }}>
                <summary>Ver Tokens Crudos (SessionStorage)</summary>
                <pre>{JSON.stringify(tokens, null, 2)}</pre>
              </details>
            </section>
          )}

          {/* Resultado de la Última Petición */}
          {resultadoApi && (
            <section>
              <h2>Resultado de la Comprobación: {resultadoApi.prueba}</h2>
              <div style={{ margin: '0.5rem 0 1rem' }}>
                <span
                  className={`badge ${
                    resultadoApi.status >= 200 && resultadoApi.status < 300
                      ? 'badge-ok'
                      : resultadoApi.status === 403
                      ? 'badge-aviso'
                      : 'badge-mal'
                  }`}
                  style={{ fontSize: '0.95rem', padding: '0.35rem 0.8rem' }}
                >
                  HTTP {resultadoApi.status} {resultadoApi.statusText}
                </span>
                <p style={{ marginTop: '0.6rem', fontWeight: 500 }}>{resultadoApi.diagnostico}</p>
              </div>

              <pre>{JSON.stringify(resultadoApi.data, null, 2)}</pre>
            </section>
          )}
        </>
      )}
    </main>
  )
}
