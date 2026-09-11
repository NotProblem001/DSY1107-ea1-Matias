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

  // Permisos granulares de negocio (soporta tanto solicitudes/* como pedidos/*)
  const puedeLeer = scopesTokens.some(s => s.endsWith('/read')) || gruposUsuario.length > 0
  const puedeCrear = scopesTokens.some(s => s.endsWith('/write')) || gruposUsuario.includes('clientes') || gruposUsuario.includes('administradores')
  const puedeAprobar = scopesTokens.some(s => s.endsWith('/approve')) || gruposUsuario.includes('editores') || gruposUsuario.includes('administradores')

  // Identificación de los 3 Perfiles Demo + Admin
  const esAdmin = gruposUsuario.includes('administradores')
  const esEditor = !esAdmin && (gruposUsuario.includes('editores') || puedeAprobar)
  const esCliente = !esAdmin && !esEditor && (gruposUsuario.includes('clientes') || puedeCrear)
  const esLector = !esAdmin && !esEditor && !esCliente && (gruposUsuario.includes('lectores') || puedeLeer)

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
    if (e) e.preventDefault()
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
            No hay sesión activa. Para interactuar con el sistema puedes iniciar el flujo <strong>Authorization Code con PKCE</strong> mediante el Hosted UI de Cognito o probar el acceso público.
          </p>

          {/* Cuadro de Cuentas Demo Precargadas para Evaluación */}
          <div className="info-box" style={{ background: '#131826', border: '1px solid var(--acento)', borderRadius: '8px', padding: '1.25rem', marginTop: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: 'var(--acento)', fontSize: '1.05rem', fontWeight: 600 }}>
              Cuentas demo precargadas para evaluación:
            </h3>
            <ul style={{ margin: '0 0 0.85rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
              <li>
                <strong>Lector:</strong> <code>lector@pedidos360.com</code> (Grupo: <code>lectores</code> &rarr; Scopes: <code>solicitudes/read</code>)
              </li>
              <li>
                <strong>Cliente:</strong> <code>cliente@pedidos360.com</code> (Grupo: <code>clientes</code> &rarr; Scopes: <code>solicitudes/read</code>, <code>solicitudes/write</code>)
              </li>
              <li>
                <strong>Editor:</strong> <code>editor@pedidos360.com</code> (Grupo: <code>editores</code> &rarr; Scopes: <code>solicitudes/read</code>, <code>solicitudes/approve</code>)
              </li>
            </ul>
            <div style={{ fontSize: '0.88rem', color: 'var(--tenue)', borderTop: '1px solid var(--borde)', paddingTop: '0.65rem' }}>
              🔑 <strong>Contraseña para todas las cuentas:</strong> <code>Pedidos360!</code>
            </div>
          </div>

          <div className="acciones">
            <button className="primario" onClick={() => login().catch((e) => setError(e.message))}>
              Iniciar sesión con Hosted UI
            </button>
            <button onClick={() => ejecutarAccion('Consulta Pública Sin Autenticación (/publico/datos)', () => obtenerDatosPublicos())}>
              Probar como Usuario Público (GET /publico/datos)
            </button>
            <button onClick={() => ejecutarAccion('Consulta Privada Sin Autenticación (GET /pedidos)', () => probarSinToken('/pedidos', 'GET'))}>
              Simular Público a Ruta Privada (Esperado 401)
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Panel de Sesión y Claims */}
          <section>
            <h2>Sesión Activa</h2>

            {/* Banner Explícito del Rol Autenticado */}
            <div style={{ marginBottom: '1rem' }}>
              {esAdmin ? (
                <div style={{ background: 'rgba(87, 217, 163, 0.12)', border: '1px solid var(--ok)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-ok" style={{ margin: 0 }}>⚡ ROL ADMINISTRADOR</span>
                    <strong>Control Total del Sistema</strong>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>
                    Posees permisos de lectura, creación y aprobación completa (scopes <code>solicitudes/read</code>, <code>solicitudes/write</code>, <code>solicitudes/approve</code>).
                  </p>
                </div>
              ) : esEditor ? (
                <div style={{ background: 'rgba(87, 217, 163, 0.12)', border: '1px solid var(--ok)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-ok" style={{ margin: 0 }}>⚖️ ROL EDITOR</span>
                    <strong>Lectura y Aprobación de Pedidos</strong>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>
                    Posees permisos de consulta y aprobación (scopes <code>solicitudes/read</code> y <code>solicitudes/approve</code>). Puedes aprobar y gestionar estados. Creación bloqueada.
                  </p>
                </div>
              ) : esCliente ? (
                <div style={{ background: 'rgba(110, 168, 254, 0.12)', border: '1px solid var(--acento)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-scope" style={{ margin: 0 }}>✍️ ROL CLIENTE</span>
                    <strong>Lectura y Creación de Pedidos</strong>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>
                    Posees permisos de consulta y registro de nuevos pedidos (scopes <code>solicitudes/read</code> y <code>solicitudes/write</code>). Aprobación reservada a Editores.
                  </p>
                </div>
              ) : esLector ? (
                <div style={{ background: 'rgba(246, 193, 119, 0.12)', border: '1px solid var(--aviso)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-aviso" style={{ margin: 0 }}>👁️ ROL LECTOR</span>
                    <strong>Modo Solo Lectura</strong>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>
                    Posees permisos de consulta (scope <code>solicitudes/read</code>). <strong>No tienes permisos de creación ni aprobación</strong>. Los formularios de registro y botones de acción están bloqueados.
                  </p>
                </div>
              ) : (
                <div style={{ background: 'rgba(110, 168, 254, 0.12)', border: '1px solid var(--acento)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <span className="badge badge-scope">USUARIO AUTENTICADO ESTÁNDAR</span>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>Sin scopes de negocio específicos.</p>
                </div>
              )}
            </div>

            <dl>
              <dt>Usuario Autenticado</dt>
              <dd><strong>{emailUsuario || '—'}</strong></dd>

              <dt>Grupo(s) Cognito</dt>
              <dd className="mono">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {gruposUsuario.length > 0 ? (
                    gruposUsuario.map(g => (
                      <span key={g} className="badge badge-scope destacado">{g}</span>
                    ))
                  ) : (
                    '(sin grupo asignado)'
                  )}
                </div>
              </dd>

              <dt>Scopes en Access Token</dt>
              <dd>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {scopesTokens.map((s) => (
                    <span
                      key={s}
                      className={`badge badge-scope ${s.startsWith('pedidos') ? 'destacado' : ''}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
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

            <details style={{ marginTop: '1rem', background: '#121725', border: '1px solid var(--borde)', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--acento)', fontWeight: 500 }}>
                📋 Ver cuentas demo precargadas para evaluación
              </summary>
              <div style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.7' }}>
                  <li><strong>Lector:</strong> <code>lector@pedidos360.com</code> (Grupo: <code>lectores</code> &rarr; Scopes: <code>solicitudes/read</code>)</li>
                  <li><strong>Cliente:</strong> <code>cliente@pedidos360.com</code> (Grupo: <code>clientes</code> &rarr; Scopes: <code>solicitudes/read</code>, <code>solicitudes/write</code>)</li>
                  <li><strong>Editor:</strong> <code>editor@pedidos360.com</code> (Grupo: <code>editores</code> &rarr; Scopes: <code>solicitudes/read</code>, <code>solicitudes/approve</code>)</li>
                </ul>
                <div style={{ marginTop: '0.4rem', color: 'var(--tenue)' }}>
                  🔑 Contraseña para todas: <code>Pedidos360!</code>
                </div>
              </div>
            </details>

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
              Gestión de Pedidos {puedeCrear ? '(Creación Habilitada)' : puedeAprobar ? '(Aprobación Habilitada)' : '(Solo Lectura)'}
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'seguridad' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('seguridad')}
            >
              Consola Scope Guard (3 Perfiles RA1)
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'tokens' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('tokens')}
            >
              Inspector JWT
            </button>
          </div>

          {/* PESTAÑA 1: GESTIÓN DE PEDIDOS */}
          {pestanaActiva === 'pedidos' && (
            <section>
              <h2>Listado de Pedidos</h2>
              <p className="sub">
                {esAdmin
                  ? 'Visualización, creación y aprobación activa de pedidos (Control Total Administrador).'
                  : esCliente
                  ? 'Visualización y creación activa de nuevos pedidos (Rol Cliente).'
                  : esEditor
                  ? 'Visualización y aprobación de pedidos (Rol Editor).'
                  : 'Visualización de pedidos en modo Solo Lectura (Rol Lector).'}
              </p>

              {/* Formulario de Nuevo Pedido */}
              {puedeCrear ? (
                <form onSubmit={handleCrearPedido} style={{ marginBottom: '1.5rem', background: '#121824', padding: '1rem', borderRadius: '8px', border: '1px solid var(--borde)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--ok)' }}>✍️ Registrar Nuevo Pedido (Habilitado para Cliente / Administrador)</h3>
                    <span className="badge badge-ok">solicitudes/write</span>
                  </div>
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
                    Crear Pedido en Cloud (POST /pedidos)
                  </button>
                </form>
              ) : (
                /* Vista para Lector o Editor: Formulario Bloqueado Explicando la Restricción */
                <div style={{ marginBottom: '1.5rem', background: '#111624', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--borde)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--aviso)' }}>🔒 Registro de Pedidos Bloqueado ({esEditor ? 'Rol Editor' : 'Rol Lector'})</h3>
                    <span className="badge badge-aviso">{esEditor ? 'Solo Aprobación' : 'Solo Lectura'}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--tenue)', margin: '0 0 0.75rem' }}>
                    Tu cuenta <strong>{emailUsuario}</strong> no tiene permisos de creación (carece de <code>solicitudes/write</code>).
                    Para registrar un nuevo pedido debes iniciar sesión como Cliente (<code>cliente@pedidos360.com</code>) o Administrador.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      🚫 Creación Deshabilitada para tu Rol
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCrearPedido()}
                      style={{ fontSize: '0.8rem', borderColor: 'var(--mal)', color: 'var(--mal)' }}
                      title="Forzar envío para comprobar que el Scope Guard de API Gateway rechaza con 403 Forbidden"
                    >
                      Probar Envío Forzado (Demostrar 403 Forbidden en API Gateway)
                    </button>
                  </div>
                </div>
              )}

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
                      <th>Acciones Permiso</th>
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
                            {puedeAprobar || esAdmin ? (
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                {p.estado !== 'COMPLETADO' && (
                                  <button
                                    disabled={cargando}
                                    onClick={() => handleCambiarEstado(p.id, 'COMPLETADO')}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--ok)' }}
                                    title="Aprobar pedido (requiere scope solicitudes/approve)"
                                  >
                                    Aprobar / Completar
                                  </button>
                                )}
                                {esAdmin && (
                                  <button
                                    disabled={cargando}
                                    onClick={() => handleEliminar(p.id)}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--mal)' }}
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="badge" style={{ background: '#1c2438', color: 'var(--tenue)', margin: 0 }}>
                                {esCliente ? '🔒 Aprobación reservada a Editores' : '🔒 Solo Lectura'}
                              </span>
                            )}
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

          {/* PESTAÑA 2: CONSOLA SCOPE GUARD (3 PERFILES RA1) */}
          {pestanaActiva === 'seguridad' && (
            <section>
              <h2>Consola de Verificación Scope Guard (RA1)</h2>
              <p className="sub" style={{ margin: '0 0 1rem' }}>
                Demostración del control de acceso perimetral según los 3 perfiles de evaluación:
              </p>

              <div className="grid-pruebas">
                {/* 1. Acceso como Usuario Público */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge" style={{ background: '#222d45', color: '#90b4fe' }}>Público</span>
                    <h4>1. Ruta Abierta (/publico/datos)</h4>
                    <p>Acceso anónimo libre sin autorizador en API Gateway.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('1. Ruta Pública (GET /publico/datos)', () => obtenerDatosPublicos())}
                  >
                    Probar (Esperado 200 OK)
                  </button>
                </div>

                {/* 2. Público intentando entrar a ruta privada */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge" style={{ background: '#222d45', color: '#90b4fe' }}>Público</span>
                    <h4>2. Consulta Privada Sin Token</h4>
                    <p>API Gateway bloquea por falta de Authorization Bearer.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() => ejecutarAccion('2. Privada Sin Token (GET /pedidos)', () => probarSinToken('/pedidos', 'GET'))}
                  >
                    Probar (Esperado 401)
                  </button>
                </div>

                {/* 3. Lectura de Pedidos (Lector, Cliente, Editor) */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-aviso">Lector / Cliente / Editor</span>
                    <h4>3. Lectura de Pedidos (GET /pedidos)</h4>
                    <p>Requiere scope <code>solicitudes/read</code>. Permitido para los 3 roles.</p>
                  </div>
                  <button
                    className="primario"
                    disabled={cargando}
                    onClick={() => ejecutarAccion('3. Lectura Pedidos (GET /pedidos)', () => obtenerPedidos(tokens.access_token))}
                  >
                    Consultar (Esperado 200 OK)
                  </button>
                </div>

                {/* 4. Creación de Pedidos (Cliente) */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge" style={{ background: '#222d45', color: '#90b4fe' }}>Cliente</span>
                    <h4>4. Creación de Pedidos (POST /pedidos)</h4>
                    <p>Requiere scope <code>solicitudes/write</code>. Autorizado para Cliente; 403 para Lector y Editor.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('4. Creación Pedido (POST /pedidos)', () =>
                        crearPedido(tokens.access_token, {
                          clienteEmail: emailUsuario,
                          descripcion: 'Dispositivo IoT Sensor de Temperatura Industrial',
                          monto: 145000,
                          estado: 'PENDIENTE',
                        }), true
                      )
                    }
                  >
                    Probar (201 Cliente / 403 Lector, Editor)
                  </button>
                </div>

                {/* 5. Aprobación de Pedidos (Editor) */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-ok">Editor</span>
                    <h4>5. Aprobación Pedido (PUT /pedidos/1)</h4>
                    <p>Requiere scope <code>solicitudes/approve</code>. Autorizado para Editor; 403 para Lector y Cliente.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('5. Aprobación Pedido (PUT /pedidos/1)', () =>
                        actualizarPedido(tokens.access_token, 1, {
                          id: 1,
                          clienteEmail: 'cliente@pedidos360.com',
                          descripcion: 'Servidor Dell PowerEdge R750',
                          monto: 3599990.0,
                          estado: 'COMPLETADO',
                        }), true
                      )
                    }
                  >
                    Probar (200 Editor / 403 Lector, Cliente)
                  </button>
                </div>

                {/* 6. Ruta Protegida con scope openid */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-scope">Cualquier Autenticado</span>
                    <h4>6. Datos del Sistema (GET /datos)</h4>
                    <p>Requiere autenticación estándar OIDC (scope <code>openid</code>).</p>
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
