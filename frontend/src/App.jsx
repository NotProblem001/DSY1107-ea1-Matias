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

  // Determinación de los 3 tipos de usuarios del sistema
  const esAdmin = scopesTokens.includes('pedidos/write') || gruposUsuario.includes('administradores') || gruposUsuario.includes('editores')
  const esLector = !esAdmin && (scopesTokens.includes('pedidos/read') || gruposUsuario.includes('lectores') || gruposUsuario.includes('clientes'))

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

          {/* Comparativa Explícita de los 3 Tipos de Usuarios */}
          <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: 'var(--texto)' }}>
              Matriz de los 3 Perfiles de Usuario en Pedidos360:
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {/* Perfil 1: Público */}
              <div style={{ background: '#131825', border: '1px solid var(--borde)', borderRadius: '8px', padding: '1rem' }}>
                <span className="badge" style={{ background: '#222d45', color: '#90b4fe' }}>1. Usuario Público</span>
                <p style={{ fontSize: '0.85rem', margin: '0.5rem 0' }}>
                  <strong>Sin autenticación:</strong> Puede acceder únicamente a datos abiertos de contraste (<code>GET /publico/datos</code>). No tiene acceso a pedidos (401).
                </p>
              </div>

              {/* Perfil 2: Lector */}
              <div style={{ background: '#131825', border: '1px solid var(--borde)', borderRadius: '8px', padding: '1rem' }}>
                <span className="badge badge-aviso">2. Usuario Lector</span>
                <p style={{ fontSize: '0.85rem', margin: '0.5rem 0' }}>
                  <strong>Solo Lectura:</strong> <code>lector@pedidos360.com</code> (Scope <code>pedidos/read</code>). Puede consultar pedidos. <strong>Sin permisos de escritura/modificación</strong>.
                </p>
              </div>

              {/* Perfil 3: Administrador */}
              <div style={{ background: '#131825', border: '1px solid var(--borde)', borderRadius: '8px', padding: '1rem' }}>
                <span className="badge badge-ok">3. Usuario Administrador</span>
                <p style={{ fontSize: '0.85rem', margin: '0.5rem 0' }}>
                  <strong>Control Total:</strong> <code>admin@pedidos360.com</code> (Scopes <code>pedidos/read</code> y <code>pedidos/write</code>). Puede consultar, crear, modificar y eliminar pedidos.
                </p>
              </div>
            </div>
          </div>

          <div className="info-box">
            <strong>Credenciales Demo para Evaluación (Contraseña: <code>Pedidos360!</code>):</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              <li>
                <strong>Lector / Cliente:</strong> <code>lector@pedidos360.com</code> &rarr; Scope asignado por Lambda V2: <code>pedidos/read</code> (Solo lectura).
              </li>
              <li>
                <strong>Administrador / Editor:</strong> <code>admin@pedidos360.com</code> &rarr; Scopes asignados por Lambda V2: <code>pedidos/read</code> y <code>pedidos/write</code> (Lectura y Escritura).
              </li>
            </ul>
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

            {/* Banner Explícito del Tipo de Usuario Autenticado */}
            <div style={{ marginBottom: '1rem' }}>
              {esAdmin ? (
                <div style={{ background: 'rgba(87, 217, 163, 0.12)', border: '1px solid var(--ok)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-ok" style={{ margin: 0 }}>⚡ PERFIL 3: ADMINISTRADOR / EDITOR</span>
                    <strong>Control Total de Pedidos</strong>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>
                    Posees permisos de lectura y escritura (<code>pedidos/read</code>, <code>pedidos/write</code>). Tienes acceso a registrar pedidos, modificar su estado y eliminarlos.
                  </p>
                </div>
              ) : esLector ? (
                <div style={{ background: 'rgba(246, 193, 119, 0.12)', border: '1px solid var(--aviso)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-aviso" style={{ margin: 0 }}>👁️ PERFIL 2: LECTOR / CLIENTE</span>
                    <strong>Modo Solo Lectura</strong>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>
                    Posees permisos de consulta (<code>pedidos/read</code>). <strong>No tienes permisos de creación ni modificación (pedidos/write)</strong>. El formulario de creación y los botones de acción están restringidos para tu perfil.
                  </p>
                </div>
              ) : (
                <div style={{ background: 'rgba(110, 168, 254, 0.12)', border: '1px solid var(--acento)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <span className="badge badge-scope">USUARIO AUTENTICADO ESTÁNDAR</span>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>Sin scopes de negocio específicos de pedidos.</p>
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
              Gestión de Pedidos {esLector ? '(Solo Lectura)' : '(Control Total)'}
            </button>
            <button
              className={`tab-boton ${pestanaActiva === 'seguridad' ? 'activo' : ''}`}
              onClick={() => setPestanaActiva('seguridad')}
            >
              Consola Scope Guard (3 Perfiles)
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
                  ? 'Visualización y administración activa de pedidos. Tu perfil cuenta con permisos de lectura y escritura.'
                  : 'Visualización de pedidos en modo Solo Lectura. Tu perfil cuenta con permisos de consulta y no puede crear ni modificar registros.'}
              </p>

              {/* Formulario de Nuevo Pedido (Exclusivo o Restringido según Perfil) */}
              {esAdmin ? (
                <form onSubmit={handleCrearPedido} style={{ marginBottom: '1.5rem', background: '#121824', padding: '1rem', borderRadius: '8px', border: '1px solid var(--borde)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--ok)' }}>⚡ Registrar Nuevo Pedido (Habilitado para Administrador)</h3>
                    <span className="badge badge-ok">pedidos/write</span>
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
                /* Vista para Lector: Formulario Bloqueado Explicando la Restricción */
                <div style={{ marginBottom: '1.5rem', background: '#111624', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--borde)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--aviso)' }}>🔒 Registro de Pedidos Bloqueado (Rol Lector)</h3>
                    <span className="badge badge-aviso">Solo Lectura</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--tenue)', margin: '0 0 0.75rem' }}>
                    Tu cuenta <strong>{emailUsuario}</strong> no tiene permisos de escritura (carece de <code>pedidos/write</code>).
                    Para registrar un nuevo pedido debes iniciar sesión como Administrador (<code>admin@pedidos360.com</code>).
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      🚫 Creación Deshabilitada para Lectores
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
                            {esAdmin ? (
                              /* Acciones completas para Administrador */
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
                            ) : (
                              /* Lector: Sin acciones de modificación */
                              <span className="badge" style={{ background: '#1c2438', color: 'var(--tenue)', margin: 0 }}>
                                🔒 Sin permiso de modificación
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
                Demostración del control de acceso perimetral según los 3 perfiles de usuario del sistema:
              </p>

              <div className="grid-pruebas">
                {/* 1. Acceso como Usuario Público */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge" style={{ background: '#222d45', color: '#90b4fe' }}>Perfil: Público</span>
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
                    <span className="badge" style={{ background: '#222d45', color: '#90b4fe' }}>Perfil: Público</span>
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

                {/* 3. Lector consultando pedidos */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-aviso">Perfil: Lector</span>
                    <h4>3. Lectura de Pedidos (GET /pedidos)</h4>
                    <p>Requiere scope <code>pedidos/read</code>. Permitido para Lectores y Admins.</p>
                  </div>
                  <button
                    className="primario"
                    disabled={cargando}
                    onClick={() => ejecutarAccion('3. Lectura Pedidos (GET /pedidos)', () => obtenerPedidos(tokens.access_token))}
                  >
                    Consultar (Esperado 200 OK)
                  </button>
                </div>

                {/* 4. Lector intentando crear pedido */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-aviso">Perfil: Lector</span>
                    <h4>4. Intento Escritura Lector</h4>
                    <p>Scope Guard bloquea en el borde por falta de <code>pedidos/write</code>.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('4. Intento Escritura Lector (POST /pedidos)', () =>
                        crearPedido(tokens.access_token, {
                          clienteEmail: emailUsuario,
                          descripcion: 'Dispositivo IoT Sensor de Temperatura Industrial',
                          monto: 145000,
                          estado: 'PENDIENTE',
                        }), true
                      )
                    }
                  >
                    Probar (201 Admin / 403 Lector)
                  </button>
                </div>

                {/* 5. Administrador creando pedido */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-ok">Perfil: Administrador</span>
                    <h4>5. Creación Pedido (Admin)</h4>
                    <p>Autorizado por poseer scope <code>pedidos/write</code>.</p>
                  </div>
                  <button
                    disabled={cargando}
                    onClick={() =>
                      ejecutarAccion('5. Creación Pedido Admin (POST /pedidos)', () =>
                        crearPedido(tokens.access_token, {
                          clienteEmail: emailUsuario || 'admin@pedidos360.com',
                          descripcion: 'Servidor Blade HPE ProLiant Gen11',
                          monto: 4950000,
                          estado: 'PENDIENTE',
                        }), true
                      )
                    }
                  >
                    Crear (201 Admin / 403 Lector)
                  </button>
                </div>

                {/* 6. Ruta Protegida con scope openid */}
                <div className="tarjeta-prueba">
                  <div>
                    <span className="badge badge-scope">Perfil: Autenticado</span>
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
