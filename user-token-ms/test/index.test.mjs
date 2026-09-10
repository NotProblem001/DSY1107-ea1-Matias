import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../index.mjs';

test('Usuario del grupo editores recibe productos/read y productos/write', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'editor-test',
    request: {
      userAttributes: { email: 'editor@duoc.cl' },
      groupConfiguration: { groupsToOverride: ['editores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['productos/read', 'productos/write']);
});

test('Usuario del grupo lectores recibe unicamente productos/read', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'lector-test',
    request: {
      userAttributes: { email: 'lector@duoc.cl' },
      groupConfiguration: { groupsToOverride: ['lectores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['productos/read']);
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
