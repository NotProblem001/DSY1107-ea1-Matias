import CuentasDemo from './CuentasDemo.jsx'
import { obtenerDatosPublicos, probarSinToken } from '../api.js'

export default function PantallaLogin({ onLogin, ejecutarAccion }) {
  return (
    <section>
      <h2>Iniciar Sesión con Amazon Cognito IDaaS</h2>
      <p>
        No hay sesión activa. Para interactuar con el sistema puedes iniciar el flujo <strong>Authorization Code con PKCE</strong> mediante el Hosted UI de Cognito o probar el acceso público.
      </p>

      <div className="info-box" style={{ background: '#131826', border: '1px solid var(--acento)', borderRadius: '8px', padding: '1.25rem', marginTop: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', color: 'var(--acento)', fontSize: '1.05rem', fontWeight: 600 }}>
          Cuentas demo precargadas para evaluación:
        </h3>
        <CuentasDemo />
      </div>

      <div className="acciones">
        <button className="primario" onClick={onLogin}>
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
  )
}
