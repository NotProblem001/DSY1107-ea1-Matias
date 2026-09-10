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
  obtenerInfoPublica,
  obtenerSolicitudes,
  crearSolicitud,
  actualizarSolicitud,
  eliminarSolicitud,
  aprobarSolicitud,
  rechazarSolicitud,
  probarSinToken,
} from './api.js'

let callbackProcesado = false

export default function App() {
  const [tokens, setTokens] = useState(() => leerTokens())
  const [error, setError] = useState(null)
  const [resultadoApi, setResultadoApi] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [configCargada, setConfigCargada] = useState(false)
  const [pestanaActiva, setPestanaActiva] = useState('solicitante') // 'solicitante', 'aprobador', 'seguridad'

  // Estado de solicitudes en la UI
  const [solicitudes, setSolicitudes] = useState([])
  const [formNueva, setFormNueva] = useState({
    fechaInicio: '2026-03-01',
    fechaFin: '2026-03-12',
    dias: 10,
    motivo: 'Vacaciones de descanso anual',
  })
  const [comentariosRevision, setComentariosRevision] = useState({})

  // Inicializar configuración
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

  // Cargar solicitudes cuando haya token
  async function cargarListaSolicitudes() {
    if (!tokens?.access_token) return
    try {
      const res = await obtenerSolicitudes(tokens.access_token)
      if (Array.isArray(res.data)) {
        setSolicitudes(res.data)
      }
    } catch {
      // Si falla por 403 o 401 se maneja en las acciones de prueba
    }
  }

  useEffect(() => {
    if (tokens?.access_token) {
      cargarListaSolicitudes()
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
        await cargarListaSolicitudes()
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

  async function handleCrearSolicitud(e) {
    e.preventDefault()
    if (!tokens?.access_token) return
    const payload = {
      solicitanteEmail: emailUsuario || 'solicitante@duocuc.cl',
      fechaInicio: formNueva.fechaInicio,
      fechaFin: formNueva.fechaFin,
      dias: Number(formNueva.dias),
      motivo: formNueva.motivo,
    }
    await ejecutarAccion('Crear Solicitud de Vacaciones (POST)', () => crearSolicitud(tokens.access_token, payload), true)
  }

  async function handleAprobar(id) {
    const comentario = comentariosRevision[id] || 'Aprobado según disponibilidad del equipo.'
    await ejecutarAccion(`Aprobar Solicitud #${id} (POST)`, () =>
      aprobarSolicitud(tokens.access_token, id, { comentario, aprobadorEmail: emailUsuario }), true)
  }

  async function handleRechazar(id) {
    const comentario = comentariosRevision[id] || 'Rechazado por tope de fechas con otros miembros.'
    await ejecutarAccion(`Rechazar Solicitud #${id} (POST)`, () =>
      rechazarSolicitud(tokens.access_token, id, { comentario, aprobadorEmail: emailUsuario }), true)
  }

  async function handleEliminar(id) {
    if (!window.confirm(`¿Deseas eliminar la solicitud #${id}?`)) return
    await ejecutarAccion(`Eliminar Solicitud #${id} (DELETE)`, () => eliminarSolicitud(tokens.access_token, id), true)
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
        <h1>DSY1107 · Gestión de Solicitudes de Vacaciones</h1>
        <p className="sub">
          Arquitectura Cloud Native · Seguridad Perimetral con AWS Cognito IDaaS + API Gateway Scope Guard
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
            No hay sesión activa. Al pulsar el botón se iniciará el flujo <strong>Authorization Code con PKCE</strong> mediante el Hosted UI de Cognito.
          </p>
          <div className="info-box">
            <strong>Cuentas demo precargadas para evaluación:</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              <li>
                <strong>Solicitante:</strong> <code>solicitante@duocuc.cl</code> / <code>CloudNative2024</code> (Grupo: <code>solicitantes</code> &rarr; Scopes: <code>solicitudes/read</code>, <code>solicitudes/write</code>)
              </li>
              <li>
                <strong>Aprobador:</strong> <code>aprobador@duocuc.cl</code> / <code>CloudNative2024</code> (Grupo: <code>aprobadores</code> &rarr; Scopes: <code>solicitudes/read</code>, <code>solicitudes/approve</code>)
              </li>
            </ul>
          </div>
          <div className="acciones">
            <button className="primario" onClick={() => login().catch((e) => setError(e.message))}>
              Iniciar sesión con Hosted UI
            </button>
            <button onClick={() => ejecutarAccion('Consulta Pública Sin Autenticación', () => obtenerInfoPublica())}>
              Probar Endpoint Público (/publico/info)
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
                  '(sin grupo)'
                )}
              </dd>

              <dt>Scopes en Access Token</dt>
              <dd>
                {scopesTokens.map((s) => (
                  <span
                    key={s}
                    className={`badge badge-scope ${s.startsWith('solicitudes') ? 'destacado' : ''}`}
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

          {/* Navegación por Pestañas */}
          <div className="tabs">
            <button
              className={`tab-boton ${pestanaActiva === 'solicitante' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('solicitante')}
            >
              Vista Solicitante
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'aprobador' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('aprobador')}
            >
              Vista Aprobador
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'seguridad' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('seguridad')}
            >
              Matriz Scope Guard (RA1)
            </button>
          </div>

          {/* PESTAÑA 1: VISTA SOLICITANTE */}
          {pestanaActiva === 'solicitante' && (
            <section>
              <h2>Mis Solicitudes de Vacaciones</h2>
              <p className="sub">
                Crear y consultar solicitudes. Requiere scopes <code>solicitudes/read</code> y <code>solicitudes/write</code>.
              </p>

              {/* Formulario de Radicación */}
              <form onSubmit={handleCrearSolicitud} style={{ marginBottom: '1.5rem' }}>
                <h3>Nueva Solicitud de Vacaciones</h3>
                <div className="form-grid">
                  <div className="form-campo">
                    <label>Fecha Inicio</label>
                    <input
                      type="date"
                      value={formNueva.fechaInicio}
                      onChange={(e) => setFormNueva({ ...formNueva, fechaInicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-campo">
                    <label>Fecha Fin</label>
                    <input
                      type="date"
                      value={formNueva.fechaFin}
                      onChange={(e) => setFormNueva({ ...formNueva, fechaFin: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-campo">
                    <label>Días Hábiles</label>
                    <input
                      type="number"
                      min="1"
                      value={formNueva.dias}
                      onChange={(e) => setFormNueva({ ...formNueva, dias: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-campo" style={{ gridColumn: '1 / -1' }}>
                    <label>Motivo / Justificación</label>
                    <input
                      type="text"
                      placeholder="Ej: Vacaciones legales de descanso anual"
                      value={formNueva.motivo}
                      onChange={(e) => setFormNueva({ ...formNueva, motivo: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="primario" disabled={cargando}>
                  Radicar Solicitud (Requiere solicitudes/write)
                </button>
              </form>

              {/* Listado de Solicitudes */}
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Solicitante</th>
                      <th>Periodo</th>
                      <th>Días</th>
                      <th>Motivo</th>
                      <th>Estado</th>
                      <th>Comentario Revisión</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', color: 'var(--tenue)' }}>
                          No hay solicitudes registradas o pulsa 'Actualizar' para recargar.
                        </td>
                      </tr>
                    ) : (
                      solicitudes.map((s) => (
                        <tr key={s.id}>
                          <td><strong>#{s.id}</strong></td>
                          <td>{s.solicitanteEmail}</td>
                          <td>{s.fechaInicio} &rarr; {s.fechaFin}</td>
                          <td>{s.dias}</td>
                          <td>{s.motivo}</td>
                          <td>
                            <span
                              className={`badge ${
                                s.estado === 'APROBADA'
                                  ? 'badge-aprobada'
                                  : s.estado === 'RECHAZADA'
                                  ? 'badge-rechazada'
                                  : 'badge-pendiente'
                              }`}
                            >
                              {s.estado}
                            </span>
                          </td>
                          <td>
                            {s.comentarioRevision ? (
                              <div className="comentario-caja">
                                <div>"{s.comentarioRevision}"</div>
                                <small style={{ opacity: 0.7 }}>Por: {s.aprobadorEmail || 'Revisor'}</small>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <button
                              disabled={cargando}
                              onClick={() => handleEliminar(s.id)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', color: 'var(--mal)' }}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button disabled={cargando} onClick={() => ejecutarAccion('Listar Solicitudes (GET)', () => obtenerSolicitudes(tokens.access_token), true)}>
                  Actualizar Lista (GET /solicitudes)
                </button>
              </div>
            </section>
          )}

          {/* PESTAÑA 2: VISTA APROBADOR */}
          {pestanaActiva === 'aprobador' && (
            <section>
              <h2>Bandeja de Aprobación (Jefatura / RRHH)</h2>
              <p className="sub">
                Revisar solicitudes y ejecutar acción de Aprobar o Rechazar con comentario. Requiere scope <code>solicitudes/approve</code>.
              </p>

              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Solicitante</th>
                      <th>Fechas</th>
                      <th>Días</th>
                      <th>Motivo</th>
                      <th>Estado Actual</th>
                      <th>Comentario de Revisión</th>
                      <th>Decisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', color: 'var(--tenue)' }}>
                          No hay solicitudes para revisar.
                        </td>
                      </tr>
                    ) : (
                      solicitudes.map((s) => (
                        <tr key={s.id}>
                          <td><strong>#{s.id}</strong></td>
                          <td>{s.solicitanteEmail}</td>
                          <td>{s.fechaInicio} &rarr; {s.fechaFin}</td>
                          <td>{s.dias}</td>
                          <td>{s.motivo}</td>
                          <td>
                            <span
                              className={`badge ${
                                s.estado === 'APROBADA'
                                  ? 'badge-aprobada'
                                  : s.estado === 'RECHAZADA'
                                  ? 'badge-rechazada'
                                  : 'badge-pendiente'
                              }`}
                            >
                              {s.estado}
                            </span>
                          </td>
                          <td style={{ minWidth: '220px' }}>
                            <input
                              type="text"
                              placeholder="Observación de la jefatura..."
                              value={comentariosRevision[s.id] || ''}
                              onChange={(e) =>
                                setComentariosRevision({
                                  ...comentariosRevision,
                                  [s.id]: e.target.value,
                                })
                              }
                              style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}
                            />
                          </td>
                          <td style={{ minWidth: '170px' }}>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                disabled={cargando}
                                onClick={() => handleAprobar(s.id)}
                                style={{
                                  padding: '0.4rem 0.7rem',
                                  fontSize: '0.8rem',
                                  borderColor: 'var(--ok)',
                                  color: 'var(--ok)',
                                }}
                              >
                                Aprobar
                              </button>
                              <button
                                disabled={cargando}
                                onClick={() => handleRechazar(s.id)}
                                style={{
                                  padding: '0.4rem 0.7rem',
                                  fontSize: '0.8rem',
                                  borderColor: 'var(--mal)',
                                  color: 'var(--mal)',
                                }}
                              >
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* PESTAÑA 3: MATRIZ DE VERIFICACIÓN Y SCOPE GUARD */}
          {pestanaActiva === 'seguridad' && (
            <section>
              <h2>Matriz de Verificación y Scope Guard (RA1)</h2>
              <p className="sub" style={{ margin: '0 0 1rem' }}>
                Comprobación en vivo del filtrado perimetral en AWS API Gateway según la identidad y scopes del usuario:
              </p>

              <div className="grid-pruebas">
                {/* Caso 1: Petición sin token */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>1. Petición Sin Token</h4>
                    <p><code>GET /solicitudes</code> sin cabecera Authorization.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('1. Sin Token (GET /solicitudes)', () => probarSinToken('/solicitudes'))}
                  >
                    Probar (Esperado 401)
                  </button>
                </div>

                {/* Caso 2: Ruta Pública */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>2. Ruta Pública (/publico/info)</h4>
                    <p><code>GET /publico/info</code> sin autorizador en Gateway.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('2. Ruta Pública (/publico/info)', () => obtenerInfoPublica())}
                  >
                    Probar (Esperado 200)
                  </button>
                </div>

                {/* Caso 3: Consulta Solicitudes */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>3. Consulta Solicitudes</h4>
                    <p><code>GET /solicitudes</code> requiere scope <code>solicitudes/read</code>.</p>
                  </div>
                  <button
                    className="primario"
                    disabled={cargando}
                    onClick={() => ejecutarAccion('3. Consulta Solicitudes (GET)', () => obtenerSolicitudes(tokens.access_token))}
                  >
                    Consultar (Esperado 200)
                  </button>
                </div>

                {/* Caso 4: Crear Solicitud */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>4. Crear Solicitud (POST)</h4>
                    <p><code>POST /solicitudes</code> requiere scope <code>solicitudes/write</code>.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('4. Crear Solicitud (POST)', () =>
                        crearSolicitud(tokens.access_token, {
                          solicitanteEmail: emailUsuario,
                          fechaInicio: '2026-09-01',
                          fechaFin: '2026-09-15',
                          dias: 14,
                          motivo: 'Vacaciones de primavera',
                        }), true
                      )
                    }
                  >
                    Crear (201 Solicitante / 403 Aprobador)
                  </button>
                </div>

                {/* Caso 5: Acción Aprobar */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>5. Acción Aprobar (POST)</h4>
                    <p><code>POST /solicitudes/1/aprobar</code> requiere scope <code>solicitudes/approve</code>.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('5. Aprobar Solicitud #1', () =>
                        aprobarSolicitud(tokens.access_token, 1, {
                          comentario: 'Aprobación verificada desde consola de auditoría.',
                          aprobadorEmail: emailUsuario,
                        }), true
                      )
                    }
                  >
                    Aprobar (200 Aprobador / 403 Solicitante)
                  </button>
                </div>

                {/* Caso 6: Acción Rechazar */}
                <div className="tarjeta-prueba">
                  <div>
                    <h4>6. Acción Rechazar (POST)</h4>
                    <p><code>POST /solicitudes/1/rechazar</code> requiere scope <code>solicitudes/approve</code>.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('6. Rechazar Solicitud #1', () =>
                        rechazarSolicitud(tokens.access_token, 1, {
                          comentario: 'Rechazo verificado desde consola de auditoría.',
                          aprobadorEmail: emailUsuario,
                        }), true
                      )
                    }
                  >
                    Rechazar (200 Aprobador / 403 Solicitante)
                  </button>
                </div>
              </div>
            </section>
          )}

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

            <h3>Access Token (Autorización y Scopes Inyectados por Lambda Pre-Token V2)</h3>
            <pre>{JSON.stringify(accessClaims, null, 2)}</pre>

            <h3>Tokens Crudos en LocalStorage</h3>
            <pre>{JSON.stringify(tokens, null, 2)}</pre>
          </details>
        </>
      )}
    </main>
  )
}
