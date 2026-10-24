import { obtenerDatosPublicos, obtenerDatosProtegidos, obtenerPedidos, crearPedido, actualizarPedido, probarSinToken } from '../api.js'

const PUBLICO = { background: '#222d45', color: '#90b4fe' }

// Cada prueba: quien la puede ejecutar, que demuestra y que respuesta se espera del API Gateway.
function pruebas(accessToken, emailUsuario) {
  return [
    {
      etiqueta: 'Público', estilo: PUBLICO, titulo: '1. Ruta Abierta (/publico/datos)',
      detalle: 'Acceso anónimo libre sin autorizador en API Gateway.', boton: 'Probar (Esperado 200 OK)',
      nombre: '1. Ruta Pública (GET /publico/datos)', peticion: () => obtenerDatosPublicos(),
    },
    {
      etiqueta: 'Público', estilo: PUBLICO, titulo: '2. Consulta Privada Sin Token',
      detalle: 'API Gateway bloquea por falta de Authorization Bearer.', boton: 'Probar (Esperado 401)',
      nombre: '2. Privada Sin Token (GET /pedidos)', peticion: () => probarSinToken('/pedidos', 'GET'),
    },
    {
      etiqueta: 'Lector / Cliente / Editor', clase: 'badge-aviso', titulo: '3. Lectura de Pedidos (GET /pedidos)', primario: true,
      detalle: <>Requiere scope <code>solicitudes/read</code>. Permitido para los 3 roles.</>, boton: 'Consultar (Esperado 200 OK)',
      nombre: '3. Lectura Pedidos (GET /pedidos)', peticion: () => obtenerPedidos(accessToken),
    },
    {
      etiqueta: 'Cliente', estilo: PUBLICO, titulo: '4. Creación de Pedidos (POST /pedidos)', recargar: true,
      detalle: <>Requiere scope <code>solicitudes/write</code>. Autorizado para Cliente; 403 para Lector y Editor.</>,
      boton: 'Probar (201 Cliente / 403 Lector, Editor)', nombre: '4. Creación Pedido (POST /pedidos)',
      peticion: () => crearPedido(accessToken, {
        clienteEmail: emailUsuario, descripcion: 'Dispositivo IoT Sensor de Temperatura Industrial', monto: 145000, estado: 'PENDIENTE',
      }),
    },
    {
      etiqueta: 'Editor', clase: 'badge-ok', titulo: '5. Aprobación Pedido (PUT /pedidos/1)', recargar: true,
      detalle: <>Requiere scope <code>solicitudes/approve</code>. Autorizado para Editor; 403 para Lector y Cliente.</>,
      boton: 'Probar (200 Editor / 403 Lector, Cliente)', nombre: '5. Aprobación Pedido (PUT /pedidos/1)',
      peticion: () => actualizarPedido(accessToken, 1, {
        id: 1, clienteEmail: 'cliente@pedidos360.com', descripcion: 'Servidor Dell PowerEdge R750', monto: 3599990.0, estado: 'COMPLETADO',
      }),
    },
    {
      etiqueta: 'Cualquier Autenticado', clase: 'badge-scope', titulo: '6. Datos del Sistema (GET /datos)',
      detalle: <>Requiere autenticación estándar OIDC (scope <code>openid</code>).</>, boton: 'Consultar (Esperado 200 OK)',
      nombre: '6. Datos Protegidos (GET /datos)', peticion: () => obtenerDatosProtegidos(accessToken),
    },
  ]
}

export default function PestanaScopeGuard({ accessToken, emailUsuario, cargando, ejecutarAccion }) {
  return (
    <section>
      <h2>Consola de Verificación Scope Guard (RA1)</h2>
      <p className="sub" style={{ margin: '0 0 1rem' }}>
        Demostración del control de acceso perimetral según los 3 perfiles de evaluación:
      </p>

      <div className="grid-pruebas">
        {pruebas(accessToken, emailUsuario).map((p) => (
          <div className="tarjeta-prueba" key={p.titulo}>
            <div>
              <span className={`badge ${p.clase ?? ''}`} style={p.estilo}>{p.etiqueta}</span>
              <h4>{p.titulo}</h4>
              <p>{p.detalle}</p>
            </div>
            <button
              className={p.primario ? 'primario' : undefined}
              disabled={cargando}
              onClick={() => ejecutarAccion(p.nombre, p.peticion, p.recargar)}
            >
              {p.boton}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
