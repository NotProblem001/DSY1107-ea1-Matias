/**
 * Cognito Pre Token Generation V2 Trigger
 *
 * Mapea dinámicamente los grupos de Cognito del usuario a scopes de negocio en el access token
 * usando claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd.
 *
 * Grupos:
 * - lectores / clientes -> pedidos/read
 * - editores / administradores -> pedidos/read, pedidos/write
 */
export async function handler(event) {
  const groups = event.request?.groupConfiguration?.groupsToOverride || [];
  const scopesToAdd = [];

  const esLector = groups.includes('lectores') || groups.includes('clientes');
  const esEditor = groups.includes('editores') || groups.includes('administradores');

  if (esLector || esEditor) {
    if (!scopesToAdd.includes('pedidos/read')) {
      scopesToAdd.push('pedidos/read');
    }
  }

  if (esEditor) {
    if (!scopesToAdd.includes('pedidos/write')) {
      scopesToAdd.push('pedidos/write');
    }
  }

  event.response = {
    claimsAndScopeOverrideDetails: {
      accessTokenGeneration: {
        scopesToAdd,
      },
    },
  };

  return event;
}

