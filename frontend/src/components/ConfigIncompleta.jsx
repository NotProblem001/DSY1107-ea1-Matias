export default function ConfigIncompleta({ faltantes }) {
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
