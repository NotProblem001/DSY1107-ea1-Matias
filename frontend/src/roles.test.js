import { test } from 'node:test'
import assert from 'node:assert/strict'
import { derivarPermisos } from './roles.js'

const id = (grupos) => ({ email: 'u@pedidos360.com', 'cognito:groups': grupos })
const acc = (scope) => ({ scope })

test('lector: solo lectura', () => {
  const p = derivarPermisos(id(['lectores']), acc('openid solicitudes/read'))
  assert.equal(p.esLector, true)
  assert.equal(p.puedeCrear, false)
  assert.equal(p.puedeAprobar, false)
})

test('cliente: lee y crea, no aprueba', () => {
  const p = derivarPermisos(id(['clientes']), acc('solicitudes/read solicitudes/write'))
  assert.equal(p.esCliente, true)
  assert.equal(p.puedeCrear, true)
  assert.equal(p.puedeAprobar, false)
})

test('editor: aprueba, no crea', () => {
  const p = derivarPermisos(id(['editores']), acc('pedidos/read pedidos/approve'))
  assert.equal(p.esEditor, true)
  assert.equal(p.puedeCrear, false)
})

test('administrador: todo y ningun otro rol', () => {
  const p = derivarPermisos(id(['administradores']), acc(''))
  assert.deepEqual([p.esAdmin, p.esEditor, p.esCliente, p.esLector], [true, false, false, false])
  assert.equal(p.puedeCrear && p.puedeAprobar, true)
})

test('sin sesion: sin permisos', () => {
  const p = derivarPermisos(null, null)
  assert.deepEqual([p.emailUsuario, p.puedeLeer, p.esLector], ['', false, false])
})
