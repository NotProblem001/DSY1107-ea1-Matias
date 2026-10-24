const TARJETA = { background: 'var(--tarjeta)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--borde)' }

export default function InspectorJwt({ tokens, idClaims, accessClaims }) {
  return (
    <section>
      <h2>Inspector Visual de Tokens JWT (OIDC & OAuth 2.0)</h2>
      <p className="sub">
        Diferenciación arquitectónica entre <strong>ID Token</strong> (identidad del usuario autenticado) y <strong>Access Token</strong> (autorización y scopes de negocio inyectados por Lambda Pre-Token Generation V2).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem', marginTop: '1rem' }}>
        <div style={TARJETA}>
          <h3 style={{ color: 'var(--primario)', marginTop: 0 }}>ID Token (Identidad / Claims)</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--tenue)' }}>Contiene datos del perfil de usuario (email, sub, grupos):</p>
          <pre style={{ maxHeight: '350px', overflowY: 'auto' }}>{JSON.stringify(idClaims, null, 2)}</pre>
        </div>

        <div style={TARJETA}>
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
  )
}
