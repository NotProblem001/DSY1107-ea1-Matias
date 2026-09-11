/**
 * Cognito Pre Token Generation V2 Trigger
 *
 * Mapea dinámicamente los grupos de Cognito del usuario a scopes de negocio en el access token
 * usando claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd.
 *
 * Perfiles de Evaluación:
 * - Lector (lectores): solicitudes/read, pedidos/read
 * - Cliente (clientes): solicitudes/read, solicitudes/write, pedidos/read, pedidos/write
 * - Editor (editores): solicitudes/read, solicitudes/approve, pedidos/read, pedidos/approve
 * - Administrador (administradores): control total (read, write, approve)
 */
export async function handler(event) {
  const groups = event.request?.groupConfiguration?.groupsToOverride || [];
  const scopesToAdd = [];

  // 1. Lectores, clientes, editores y administradores reciben permisos de lectura
  if (
    groups.includes('lectores') ||
    groups.includes('clientes') ||
    groups.includes('editores') ||
    groups.includes('administradores')
  ) {
    scopesToAdd.push('solicitudes/read', 'pedidos/read');
  }

  // 2. Clientes y administradores reciben permisos de creación/escritura
  if (groups.includes('clientes') || groups.includes('administradores')) {
    scopesToAdd.push('solicitudes/write', 'pedidos/write');
  }

  // 3. Editores y administradores reciben permisos de aprobación
  if (groups.includes('editores') || groups.includes('administradores')) {
    scopesToAdd.push('solicitudes/approve', 'pedidos/approve');
  }

  // Desduplicar scopes por seguridad
  const uniqueScopes = Array.from(new Set(scopesToAdd));

  event.response = {
    claimsAndScopeOverrideDetails: {
      accessTokenGeneration: {
        scopesToAdd: uniqueScopes,
      },
    },
  };

  return event;
}

