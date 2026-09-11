import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../index.mjs';

test('Usuario del grupo lectores recibe pedidos/read', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'lector-test',
    request: {
      userAttributes: { email: 'lector@pedidos360.com' },
      groupConfiguration: { groupsToOverride: ['lectores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['pedidos/read']);
});

test('Usuario del grupo clientes recibe pedidos/read', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'cliente-test',
    request: {
      userAttributes: { email: 'cliente@pedidos360.com' },
      groupConfiguration: { groupsToOverride: ['clientes'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['pedidos/read']);
});

test('Usuario del grupo editores recibe pedidos/read y pedidos/write', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'editor-test',
    request: {
      userAttributes: { email: 'editor@pedidos360.com' },
      groupConfiguration: { groupsToOverride: ['editores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['pedidos/read', 'pedidos/write']);
});

test('Usuario del grupo administradores recibe pedidos/read y pedidos/write', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'admin-test',
    request: {
      userAttributes: { email: 'admin@pedidos360.com' },
      groupConfiguration: { groupsToOverride: ['administradores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['pedidos/read', 'pedidos/write']);
});

test('Usuario en lectores y administradores recibe pedidos/read y pedidos/write sin duplicados', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'multi-test',
    request: {
      userAttributes: { email: 'multi@pedidos360.com' },
      groupConfiguration: { groupsToOverride: ['lectores', 'administradores'] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, ['pedidos/read', 'pedidos/write']);
});

test('Usuario sin grupo no recibe scopes de negocio', async () => {
  const event = {
    version: '2',
    triggerSource: 'TokenGeneration_HostedAuth',
    userName: 'sin-grupo',
    request: {
      userAttributes: { email: 'anon@pedidos360.com' },
      groupConfiguration: { groupsToOverride: [] }
    },
    response: {}
  };

  const res = await handler(event);
  const scopes = res.response.claimsAndScopeOverrideDetails.accessTokenGeneration.scopesToAdd;

  assert.deepEqual(scopes, []);
});

