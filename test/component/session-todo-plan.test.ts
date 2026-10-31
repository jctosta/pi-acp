import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

test('PiAcpSession: a todo tool end emits tool_call_update then a plan', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  new PiAcpSession({
    sessionId: 's1',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  proc.emit({ type: 'tool_execution_start', toolCallId: 't1', toolName: 'todo', args: { action: 'list' } })
  proc.emit({
    type: 'tool_execution_end',
    toolCallId: 't1',
    toolName: 'todo',
    isError: false,
    result: {
      content: [{ type: 'text', text: 'ok' }],
      details: { tasks: [{ id: 1, subject: 'Do it', status: 'in_progress' }] }
    }
  })
  await new Promise(r => setTimeout(r, 0))

  const kinds = conn.updates.map(u => (u.update as any).sessionUpdate)
  assert.deepEqual(kinds.slice(-2), ['tool_call_update', 'plan'])
  assert.deepEqual((conn.updates.at(-1)!.update as any).entries, [
    { content: 'Do it', priority: 'medium', status: 'in_progress' }
  ])
})
