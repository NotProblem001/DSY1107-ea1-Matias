import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../index.mjs';

test('Usuario del grupo solicitantes recibe solicitudes/read y solicitudes/write', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'solicitante-test',
    request: {
      userAttributes: { email: 'solicitante@duoc.cl' },
      groupConfiguration: { groupsToOverride: ['solicitantes'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['solicitudes/read', 'solicitudes/write']);
});

test('Usuario del grupo aprobadores recibe solicitudes/read y solicitudes/approve', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'aprobador-test',
    request: {
      userAttributes: { email: 'aprobador@duoc.cl' },
      groupConfiguration: { groupsToOverride: ['aprobadores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['solicitudes/read', 'solicitudes/approve']);
});

test('Usuario en ambos grupos recibe solicitudes/read, solicitudes/write y solicitudes/approve sin duplicados', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'super-test',
    request: {
      userAttributes: { email: 'admin@duoc.cl' },
      groupConfiguration: { groupsToOverride: ['solicitantes', 'aprobadores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['solicitudes/read', 'solicitudes/write', 'solicitudes/approve']);
});

test('Usuario sin grupo no recibe scopes de negocio', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'sin-grupo',
    request: {
      userAttributes: { email: 'externo@duoc.cl' },
      groupConfiguration: { groupsToOverride: [] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, []);
});
