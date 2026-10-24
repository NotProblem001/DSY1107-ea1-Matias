import { useEffect, useState } from 'react'
import {
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
import { obtenerPedidos, crearPedido, actualizarPedido, eliminarPedido } from './api.js'
import { derivarPermisos } from './roles.js'
import ConfigIncompleta from './components/ConfigIncompleta.jsx'
import PantallaLogin from './components/PantallaLogin.jsx'
import PanelSesion from './components/PanelSesion.jsx'
import PestanaPedidos from './components/PestanaPedidos.jsx'
import PestanaScopeGuard from './components/PestanaScopeGuard.jsx'
import InspectorJwt from './components/InspectorJwt.jsx'
import ResultadoApi from './components/ResultadoApi.jsx'

let callbackProcesado = false

const PESTANAS = [
  { id: 'seguridad', titulo: 'Consola Scope Guard (3 Perfiles RA1)' },
  { id: 'tokens', titulo: 'Inspector JWT' },
]

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
  const permisos = derivarPermisos(idClaims, accessClaims)
  const { emailUsuario, puedeCrear, puedeAprobar } = permisos

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
    return <ConfigIncompleta faltantes={faltantes} />
  }

  const tituloPedidos = `Gestión de Pedidos ${puedeCrear ? '(Creación Habilitada)' : puedeAprobar ? '(Aprobación Habilitada)' : '(Solo Lectura)'}`

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
        <PantallaLogin onLogin={() => login().catch((e) => setError(e.message))} ejecutarAccion={ejecutarAccion} />
      ) : (
        <>
          <PanelSesion tokens={tokens} permisos={permisos} vencido={vencido} onRenovar={renovarSesion} onLogout={logout} />

          <div className="tabs">
            {[{ id: 'pedidos', titulo: tituloPedidos }, ...PESTANAS].map((p) => (
              <button
                key={p.id}
                className={`tab-boton ${pestanaActiva === p.id ? 'activo' : ''}`}
                onClick={() => setPestanaActiva(p.id)}
              >
                {p.titulo}
              </button>
            ))}
          </div>

          {pestanaActiva === 'pedidos' && (
            <PestanaPedidos
              pedidos={pedidos}
              permisos={permisos}
              formNuevo={formNuevo}
              setFormNuevo={setFormNuevo}
              cargando={cargando}
              onCrear={handleCrearPedido}
              onCambiarEstado={handleCambiarEstado}
              onEliminar={handleEliminar}
              onActualizar={() => ejecutarAccion('Listar Pedidos (GET /pedidos)', () => obtenerPedidos(tokens.access_token), true)}
            />
          )}

          {pestanaActiva === 'seguridad' && (
            <PestanaScopeGuard
              accessToken={tokens.access_token}
              emailUsuario={emailUsuario}
              cargando={cargando}
              ejecutarAccion={ejecutarAccion}
            />
          )}

          {pestanaActiva === 'tokens' && <InspectorJwt tokens={tokens} idClaims={idClaims} accessClaims={accessClaims} />}

          {resultadoApi && <ResultadoApi resultado={resultadoApi} />}
        </>
      )}
    </main>
  )
}
