// Permisos y rol visible a partir de los claims del ID Token y del Access Token.
// Soporta scopes solicitudes/* y pedidos/*: solo importa el sufijo (read, write, approve).
export function derivarPermisos(idClaims, accessClaims) {
  const emailUsuario = idClaims?.email ?? idClaims?.['cognito:username'] ?? ''
  const grupos = idClaims?.['cognito:groups'] || []
  const scopes = accessClaims?.scope ? accessClaims.scope.split(' ') : []

  const puedeLeer = scopes.some((s) => s.endsWith('/read')) || grupos.length > 0
  const puedeCrear = scopes.some((s) => s.endsWith('/write')) || grupos.includes('clientes') || grupos.includes('administradores')
  const puedeAprobar = scopes.some((s) => s.endsWith('/approve')) || grupos.includes('editores') || grupos.includes('administradores')

  const esAdmin = grupos.includes('administradores')
  const esEditor = !esAdmin && (grupos.includes('editores') || puedeAprobar)
  const esCliente = !esAdmin && !esEditor && (grupos.includes('clientes') || puedeCrear)
  const esLector = !esAdmin && !esEditor && !esCliente && (grupos.includes('lectores') || puedeLeer)

  return { emailUsuario, grupos, scopes, puedeLeer, puedeCrear, puedeAprobar, esAdmin, esEditor, esCliente, esLector }
}
