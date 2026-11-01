import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

function setup() {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  const session = new PiAcpSession({
    sessionId: 's1',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })
  return { proc, session }
}

const errorEnd = (errorMessage: string, willRetry?: boolean) => ({
  type: 'agent_end',
  ...(willRetry === undefined ? {} : { willRetry }),
  messages: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: [], stopReason: 'error', errorMessage }
  ]
})

test('provider error ends the prompt with an ACP internal error', async () => {
  const { proc, session } = setup()
  const p = session.prompt('hi')
  const outcome = p.then(
    () => null,
    (e: any) => e
  )
  proc.emit(errorEnd('401: bad key', false))
  proc.emit({ type: 'agent_settled' })
  const err = await outcome
  assert.equal(err.code, -32603)
  assert.equal(err.message, 'Internal error: 401: bad key')
  assert.equal(err.data.errorKind, 'provider_error')
})

test('a 429 is reported as rate_limit', async () => {
  const { proc, session } = setup()
  const outcome = session.prompt('hi').then(
    () => null,
    (e: any) => e
  )
  proc.emit(errorEnd('429 Too Many Requests', false))
  proc.emit({ type: 'agent_settled' })
  assert.equal((await outcome).data.errorKind, 'rate_limit')
})

test('an error pi will retry does not fail the prompt', async () => {
  const { proc, session } = setup()
  const p = session.prompt('hi')
  proc.emit(errorEnd('overloaded', true))
  proc.emit({ type: 'agent_end', messages: [{ role: 'assistant', content: [], stopReason: 'stop' }] })
  proc.emit({ type: 'agent_settled' })
  assert.equal(await p, 'end_turn')
})

test('a cancelled turn resolves cancelled even with an error', async () => {
  const { proc, session } = setup()
  const p = session.prompt('hi')
  await session.cancel()
  proc.emit(errorEnd('aborted', false))
  proc.emit({ type: 'agent_settled' })
  assert.equal(await p, 'cancelled')
})

test('a queued prompt still starts after the first one fails', async () => {
  const { proc, session } = setup()
  const first = session.prompt('one').then(
    () => null,
    (e: any) => e
  )
  const second = session.prompt('two')
  proc.emit(errorEnd('500: boom', false))
  proc.emit({ type: 'agent_settled' })
  assert.ok(await first)
  assert.equal(proc.prompts.length, 2)
  proc.emit({ type: 'agent_end', messages: [] })
  proc.emit({ type: 'agent_settled' })
  assert.equal(await second, 'end_turn')
})
