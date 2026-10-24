import BannerRol from './BannerRol.jsx'
import CuentasDemo from './CuentasDemo.jsx'

export default function PanelSesion({ tokens, permisos, vencido, onRenovar, onLogout }) {
  const { emailUsuario, grupos, scopes } = permisos
  return (
    <section>
      <h2>Sesión Activa</h2>

      <div style={{ marginBottom: '1rem' }}>
        <BannerRol permisos={permisos} />
      </div>

      <dl>
        <dt>Usuario Autenticado</dt>
        <dd><strong>{emailUsuario || '—'}</strong></dd>

        <dt>Grupo(s) Cognito</dt>
        <dd className="mono">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {grupos.length > 0
              ? grupos.map((g) => <span key={g} className="badge badge-scope destacado">{g}</span>)
              : '(sin grupo asignado)'}
          </div>
        </dd>

        <dt>Scopes en Access Token</dt>
        <dd>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {scopes.map((s) => (
              <span key={s} className={`badge badge-scope ${s.startsWith('pedidos') ? 'destacado' : ''}`}>{s}</span>
            ))}
          </div>
        </dd>

        <dt>Estado del Token</dt>
        <dd>
          {vencido ? (
            <span className="vencido">Expirado</span>
          ) : (
            <span className="vigente">Vigente hasta {new Date(tokens.expires_at).toLocaleTimeString('es-CL')}</span>
          )}
        </dd>
      </dl>

      <details style={{ marginTop: '1rem', background: '#121725', border: '1px solid var(--borde)', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--acento)', fontWeight: 500 }}>
          📋 Ver cuentas demo precargadas para evaluación
        </summary>
        <div style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
          <CuentasDemo />
        </div>
      </details>

      <div className="acciones">
        {tokens.refresh_token && <button onClick={onRenovar}>Refrescar Token</button>}
        <button className="peligro" onClick={onLogout}>Cerrar Sesión SSO</button>
      </div>
    </section>
  )
}
