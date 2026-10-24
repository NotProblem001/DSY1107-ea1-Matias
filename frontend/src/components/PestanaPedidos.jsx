const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO']

function claseEstado(estado) {
  if (estado === 'COMPLETADO') return 'badge-aprobada'
  if (estado === 'CANCELADO') return 'badge-rechazada'
  return 'badge-pendiente'
}

function FormularioNuevo({ formNuevo, setFormNuevo, cargando, onCrear }) {
  return (
    <form onSubmit={onCrear} style={{ marginBottom: '1.5rem', background: '#121824', padding: '1rem', borderRadius: '8px', border: '1px solid var(--borde)' }}>
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
          <select value={formNuevo.estado} onChange={(e) => setFormNuevo({ ...formNuevo, estado: e.target.value })}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="primario" disabled={cargando}>
        Crear Pedido en Cloud (POST /pedidos)
      </button>
    </form>
  )
}

/* Vista para Lector o Editor: formulario bloqueado que explica la restriccion */
function FormularioBloqueado({ permisos, onCrear }) {
  const { esEditor, emailUsuario } = permisos
  return (
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
          onClick={() => onCrear()}
          style={{ fontSize: '0.8rem', borderColor: 'var(--mal)', color: 'var(--mal)' }}
          title="Forzar envío para comprobar que el Scope Guard de API Gateway rechaza con 403 Forbidden"
        >
          Probar Envío Forzado (Demostrar 403 Forbidden en API Gateway)
        </button>
      </div>
    </div>
  )
}

function AccionesPedido({ pedido, permisos, cargando, onCambiarEstado, onEliminar }) {
  const { puedeAprobar, esAdmin, esCliente } = permisos
  if (!puedeAprobar && !esAdmin) {
    return (
      <span className="badge" style={{ background: '#1c2438', color: 'var(--tenue)', margin: 0 }}>
        {esCliente ? '🔒 Aprobación reservada a Editores' : '🔒 Solo Lectura'}
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', gap: '0.3rem' }}>
      {pedido.estado !== 'COMPLETADO' && (
        <button
          disabled={cargando}
          onClick={() => onCambiarEstado(pedido.id, 'COMPLETADO')}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--ok)' }}
          title="Aprobar pedido (requiere scope solicitudes/approve)"
        >
          Aprobar / Completar
        </button>
      )}
      {esAdmin && (
        <button
          disabled={cargando}
          onClick={() => onEliminar(pedido.id)}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--mal)' }}
        >
          Eliminar
        </button>
      )}
    </div>
  )
}

export default function PestanaPedidos({ pedidos, permisos, formNuevo, setFormNuevo, cargando, onCrear, onCambiarEstado, onEliminar, onActualizar }) {
  const { esAdmin, esCliente, esEditor, puedeCrear } = permisos
  return (
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

      {puedeCrear
        ? <FormularioNuevo formNuevo={formNuevo} setFormNuevo={setFormNuevo} cargando={cargando} onCrear={onCrear} />
        : <FormularioBloqueado permisos={permisos} onCrear={onCrear} />}

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
                  <td><span className={`badge ${claseEstado(p.estado)}`}>{p.estado}</span></td>
                  <td>{p.fechaCreacion ? p.fechaCreacion.substring(0, 19).replace('T', ' ') : '—'}</td>
                  <td>
                    <AccionesPedido pedido={p} permisos={permisos} cargando={cargando} onCambiarEstado={onCambiarEstado} onEliminar={onEliminar} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <button disabled={cargando} onClick={onActualizar}>
          Actualizar Lista (GET /pedidos)
        </button>
      </div>
    </section>
  )
}
