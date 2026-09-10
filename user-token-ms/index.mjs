/**
 * Cognito Pre Token Generation V2 Trigger
 *
 * Mapea los grupos de Cognito (solicitantes, aprobadores) a scopes de negocio
 * en el access token usando claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd.
 */
export async function handler(event) {
  const groups = event.request?.groupConfiguration?.groupsToOverride || [];
  const scopesToAdd = [];

  if (groups.includes('solicitantes')) {
    scopesToAdd.push('solicitudes/read', 'solicitudes/write');
  }

  if (groups.includes('aprobadores')) {
    if (!scopesToAdd.includes('solicitudes/read')) {
      scopesToAdd.push('solicitudes/read');
    }
    scopesToAdd.push('solicitudes/approve');
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
