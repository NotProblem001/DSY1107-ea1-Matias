// Banner del rol autenticado: color, insignia y descripcion de permisos por perfil.
const ROLES = {
  admin: {
    color: 'var(--ok)', fondo: 'rgba(87, 217, 163, 0.12)', badge: 'badge-ok', insignia: '⚡ ROL ADMINISTRADOR', titulo: 'Control Total del Sistema',
    texto: <>Posees permisos de lectura, creación y aprobación completa (scopes <code>solicitudes/read</code>, <code>solicitudes/write</code>, <code>solicitudes/approve</code>).</>,
  },
  editor: {
    color: 'var(--ok)', fondo: 'rgba(87, 217, 163, 0.12)', badge: 'badge-ok', insignia: '⚖️ ROL EDITOR', titulo: 'Lectura y Aprobación de Pedidos',
    texto: <>Posees permisos de consulta y aprobación (scopes <code>solicitudes/read</code> y <code>solicitudes/approve</code>). Puedes aprobar y gestionar estados. Creación bloqueada.</>,
  },
  cliente: {
    color: 'var(--acento)', fondo: 'rgba(110, 168, 254, 0.12)', badge: 'badge-scope', insignia: '✍️ ROL CLIENTE', titulo: 'Lectura y Creación de Pedidos',
    texto: <>Posees permisos de consulta y registro de nuevos pedidos (scopes <code>solicitudes/read</code> y <code>solicitudes/write</code>). Aprobación reservada a Editores.</>,
  },
  lector: {
    color: 'var(--aviso)', fondo: 'rgba(246, 193, 119, 0.12)', badge: 'badge-aviso', insignia: '👁️ ROL LECTOR', titulo: 'Modo Solo Lectura',
    texto: <>Posees permisos de consulta (scope <code>solicitudes/read</code>). <strong>No tienes permisos de creación ni aprobación</strong>. Los formularios de registro y botones de acción están bloqueados.</>,
  },
}

export default function BannerRol({ permisos }) {
  const { esAdmin, esEditor, esCliente, esLector } = permisos
  const rol = esAdmin ? ROLES.admin : esEditor ? ROLES.editor : esCliente ? ROLES.cliente : esLector ? ROLES.lector : null

  if (!rol) {
    return (
      <div style={{ background: 'rgba(110, 168, 254, 0.12)', border: '1px solid var(--acento)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
        <span className="badge badge-scope">USUARIO AUTENTICADO ESTÁNDAR</span>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>Sin scopes de negocio específicos.</p>
      </div>
    )
  }
  return (
    <div style={{ background: rol.fondo, border: `1px solid ${rol.color}`, borderRadius: '8px', padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className={`badge ${rol.badge}`} style={{ margin: 0 }}>{rol.insignia}</span>
        <strong>{rol.titulo}</strong>
      </div>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--texto)' }}>{rol.texto}</p>
    </div>
  )
}
