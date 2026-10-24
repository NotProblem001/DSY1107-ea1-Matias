// Cuentas precargadas por terraform/cognito.tf para la evaluacion.
export default function CuentasDemo() {
  return (
    <>
      <ul style={{ margin: '0 0 0.85rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
        <li>
          <strong>Lector:</strong> <code>lector@pedidos360.com</code> (Grupo: <code>lectores</code> &rarr; Scopes: <code>pedidos/read</code>)
        </li>
        <li>
          <strong>Cliente:</strong> <code>cliente@pedidos360.com</code> (Grupo: <code>clientes</code> &rarr; Scopes: <code>pedidos/read</code>, <code>pedidos/write</code>)
        </li>
        <li>
          <strong>Editor:</strong> <code>editor@pedidos360.com</code> (Grupo: <code>editores</code> &rarr; Scopes: <code>pedidos/read</code>, <code>pedidos/approve</code>)
        </li>
        <li>
          <strong>Admin:</strong> <code>admin@pedidos360.com</code> (Grupo: <code>administradores</code> &rarr; Scopes: <code>pedidos/read</code>, <code>pedidos/write</code>, <code>pedidos/approve</code>)
        </li>
      </ul>
      <div style={{ fontSize: '0.88rem', color: 'var(--tenue)', borderTop: '1px solid var(--borde)', paddingTop: '0.65rem' }}>
        🔑 <strong>Contraseña para todas las cuentas:</strong> <code>Pedidos360!</code>
      </div>
    </>
  )
}
