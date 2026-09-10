/**
 * Cognito Pre Token Generation V2 Trigger
 *
 * Mapea los grupos de Cognito (lectores, editores) a scopes de negocio
 * en el access token usando claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd.
 */
export async function handler(event) {
  const groups = event.request?.groupConfiguration?.groupsToOverride || [];
  const scopesToAdd = [];

  if (groups.includes('editores')) {
    scopesToAdd.push('productos/read', 'productos/write');
  } else if (groups.includes('lectores')) {
    scopesToAdd.push('productos/read');
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
