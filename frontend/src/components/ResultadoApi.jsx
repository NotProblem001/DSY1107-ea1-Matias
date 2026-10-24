function claseStatus(status) {
  if (status >= 200 && status < 300) return 'badge-ok'
  if (status === 403) return 'badge-aviso'
  return 'badge-mal'
}

export default function ResultadoApi({ resultado }) {
  return (
    <section>
      <h2>Resultado de la Comprobación: {resultado.prueba}</h2>
      <div style={{ margin: '0.5rem 0 1rem' }}>
        <span className={`badge ${claseStatus(resultado.status)}`} style={{ fontSize: '0.95rem', padding: '0.35rem 0.8rem' }}>
          HTTP {resultado.status} {resultado.statusText}
        </span>
        <p style={{ marginTop: '0.6rem', fontWeight: 500 }}>{resultado.diagnostico}</p>
      </div>

      <pre>{JSON.stringify(resultado.data, null, 2)}</pre>
    </section>
  )
}
