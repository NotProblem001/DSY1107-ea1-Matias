import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../index.mjs';

test('Usuario del grupo lectores recibe solicitudes/read y pedidos/read', async () => {
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

  assert.deepEqual(scopes, ['solicitudes/read', 'pedidos/read']);
});

test('Usuario del grupo clientes recibe solicitudes/read, pedidos/read, solicitudes/write y pedidos/write', async () => {
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

  assert.deepEqual(scopes, ['solicitudes/read', 'pedidos/read', 'solicitudes/write', 'pedidos/write']);
});

test('Usuario del grupo editores recibe solicitudes/read, pedidos/read, solicitudes/approve y pedidos/approve', async () => {
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

  assert.deepEqual(scopes, ['solicitudes/read', 'pedidos/read', 'solicitudes/approve', 'pedidos/approve']);
});

test('Usuario del grupo administradores recibe todos los scopes de negocio', async () => {
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

  assert.deepEqual(scopes, [
    'solicitudes/read',
    'pedidos/read',
    'solicitudes/write',
    'pedidos/write',
    'solicitudes/approve',
    'pedidos/approve'
  ]);
});

test('Usuario en lectores y administradores recibe scopes completos sin duplicados', async () => {
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

  assert.deepEqual(scopes, [
    'solicitudes/read',
    'pedidos/read',
    'solicitudes/write',
    'pedidos/write',
    'solicitudes/approve',
    'pedidos/approve'
  ]);
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

