import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

function setup(elicitation: boolean) {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  new PiAcpSession({
    sessionId: 's1',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: [],
    elicitation
  })
  return { conn, proc }
}

const tick = () => new Promise(r => setTimeout(r, 0))

test('elicitation: a select becomes one question and the answer reaches pi', async () => {
  const { conn, proc } = setup(true)
  conn.nextElicitationResponse = { action: 'accept', content: { choice: '1' } }
  proc.emit({ type: 'extension_ui_request', id: 'u1', method: 'select', title: 'Pick', options: ['Alpha', 'Beta'] })
  await tick()
  assert.equal(conn.elicitationRequests.length, 1)
  assert.equal(conn.permissionRequests.length, 0)
  assert.deepEqual(proc.extensionUiResponses, [{ id: 'u1', value: 'Beta' }])
})

test('elicitation: an editor arrives prefilled and returns the edited text', async () => {
  const { conn, proc } = setup(true)
  conn.nextElicitationResponse = { action: 'accept', content: { value: 'edited' } }
  proc.emit({ type: 'extension_ui_request', id: 'u2', method: 'editor', title: 'Edit', prefill: 'draft' })
  await tick()
  assert.equal((conn.elicitationRequests[0] as any).requestedSchema.properties.value.default, 'draft')
  assert.deepEqual(proc.extensionUiResponses, [{ id: 'u2', value: 'edited' }])
})

test('elicitation: decline cancels the dialog', async () => {
  const { conn, proc } = setup(true)
  conn.nextElicitationResponse = { action: 'decline' }
  proc.emit({ type: 'extension_ui_request', id: 'u3', method: 'confirm', title: 'Sure?' })
  await tick()
  assert.deepEqual(proc.extensionUiResponses, [{ id: 'u3', cancelled: true }])
})

test('elicitation: a request that errors cancels the dialog', async () => {
  const { conn, proc } = setup(true)
  conn.unstable_createElicitation = async () => {
    throw new Error('boom')
  }
  proc.emit({ type: 'extension_ui_request', id: 'u4', method: 'input', title: 'Name' })
  await tick()
  assert.deepEqual(proc.extensionUiResponses, [{ id: 'u4', cancelled: true }])
})

test('elicitation: a client without the capability keeps the permission mapping', async () => {
  const { conn, proc } = setup(false)
  proc.emit({ type: 'extension_ui_request', id: 'u5', method: 'select', title: 'Pick', options: ['A'] })
  await tick()
  assert.equal(conn.elicitationRequests.length, 0)
  assert.equal(conn.permissionRequests.length, 1)
})
