import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpAgent } from '../../src/acp/agent.js'
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
  const agent = new PiAcpAgent(asAgentConn(conn))
  ;(agent as any).sessions = { maybeGet: () => session, get: () => session }
  return { agent, proc, session }
}

const steer = (agent: PiAcpAgent, params: Record<string, unknown>) => agent.extMethod('_session/steering', params)
const hello = [{ type: 'text', text: 'also do X' }]

test('initialize advertises steering', async () => {
  const { agent } = setup()
  const res = await agent.initialize({ protocolVersion: 1 } as any)
  assert.deepEqual((res as any)._meta?.steering, { supported: true })
})

test('steering during a turn reaches pi and reports injected', async () => {
  const { agent, proc, session } = setup()
  const turn = session.prompt('start')
  assert.deepEqual(await steer(agent, { sessionId: 's1', prompt: hello }), { outcome: 'injected' })
  assert.deepEqual(
    proc.steers.map(s => s.message),
    ['also do X']
  )
  assert.equal(proc.prompts.length, 1)

  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'turn_end' })
  proc.emit({ type: 'agent_end' })
  proc.emit({ type: 'agent_settled' })
  assert.equal(await turn, 'end_turn')
})

test('idle with promptRequired changes nothing', async () => {
  const { agent, proc } = setup()
  const res = await steer(agent, {
    sessionId: 's1',
    prompt: hello,
    _meta: { steering: { idleBehavior: 'promptRequired' } }
  })
  assert.deepEqual(res, { outcome: 'promptRequired', reason: 'noRunningTurn' })
  assert.equal(proc.steers.length, 0)
  assert.equal(proc.prompts.length, 0)
})

test('idle without promptRequired starts a new turn', async () => {
  const { agent, proc } = setup()
  assert.deepEqual(await steer(agent, { sessionId: 's1', prompt: hello }), { outcome: 'startedNewTurn' })
  assert.deepEqual(
    proc.prompts.map(p => p.message),
    ['also do X']
  )
})

test('invalid params are rejected', async () => {
  const { agent } = setup()
  await assert.rejects(steer(agent, { sessionId: '', prompt: hello }))
  await assert.rejects(steer(agent, { sessionId: 's1', prompt: [] }))
  await assert.rejects(steer(agent, { sessionId: 's1', prompt: hello, _meta: { steering: { idleBehavior: 'other' } } }))
})
