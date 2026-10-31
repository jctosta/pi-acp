import test from 'node:test'
import assert from 'node:assert/strict'
import {
  type PiDialog,
  dialogElicitation,
  dialogResponse,
  splitDialogTitle
} from '../../src/acp/translate/extension-dialogs.js'

const accept = (content: Record<string, string | boolean>) => ({ action: 'accept', content }) as any

test('splitDialogTitle: one paragraph has no detail', () => {
  assert.deepEqual(splitDialogTitle('Pick one'), { message: 'Pick one', detail: null })
})

test('splitDialogTitle: first paragraph is the message, the rest the detail', () => {
  const title = '[Tracker] Which issue tracker?\n\n--- 1. GitHub preview ---\nissues\n--- 2. Linear preview ---\ncycles'
  assert.deepEqual(splitDialogTitle(title), {
    message: '[Tracker] Which issue tracker?',
    detail: '--- 1. GitHub preview ---\nissues\n--- 2. Linear preview ---\ncycles'
  })
})

test('dialogElicitation: select is a oneOf of index consts', () => {
  const req: any = dialogElicitation('s1', { method: 'select', id: 'a', title: 'Pick', options: ['Alpha', 'Beta'] })
  assert.equal(req.mode, 'form')
  assert.equal(req.sessionId, 's1')
  assert.equal(req.message, 'Pick')
  assert.deepEqual(req.requestedSchema.required, ['choice'])
  assert.deepEqual(req.requestedSchema.properties.choice.oneOf, [
    { const: '0', title: 'Alpha' },
    { const: '1', title: 'Beta' }
  ])
})

test('dialogElicitation: confirm is a boolean with detail and message joined', () => {
  const req: any = dialogElicitation('s1', { method: 'confirm', id: 'a', title: 'Sure?\n\nmore', message: 'body' })
  assert.deepEqual(req.requestedSchema.properties.confirmed, {
    type: 'boolean',
    description: 'more\n\nbody'
  })
  assert.deepEqual(req.requestedSchema.required, ['confirmed'])
})

test('dialogElicitation: input carries the placeholder only when pi sent one', () => {
  const withP: any = dialogElicitation('s1', { method: 'input', id: 'a', title: 'Name', placeholder: 'x' })
  assert.deepEqual(withP.requestedSchema.properties.value._meta, { piAcp: { placeholder: 'x' } })
  const without: any = dialogElicitation('s1', { method: 'input', id: 'a', title: 'Name' })
  assert.equal('_meta' in without.requestedSchema.properties.value, false)
})

test('dialogElicitation: editor has the prefill as default and the multiline meta', () => {
  const req: any = dialogElicitation('s1', { method: 'editor', id: 'a', title: 'Edit', prefill: 'text' })
  assert.equal(req.requestedSchema.properties.value.default, 'text')
  assert.deepEqual(req.requestedSchema.properties.value._meta, { piAcp: { multiline: true } })
})

test('dialogResponse: select index maps to the option text', () => {
  const d = { method: 'select', id: 'a', title: 't', options: ['Alpha', 'Beta'] } satisfies PiDialog
  assert.deepEqual(dialogResponse(d, accept({ choice: '1' })), { id: 'a', value: 'Beta' })
})

test('dialogResponse: bad select index is cancelled', () => {
  const d = { method: 'select', id: 'a', title: 't', options: ['Alpha'] } satisfies PiDialog
  assert.deepEqual(dialogResponse(d, accept({ choice: '5' })), { id: 'a', cancelled: true })
  assert.deepEqual(dialogResponse(d, accept({})), { id: 'a', cancelled: true })
})

test('dialogResponse: confirm needs a boolean', () => {
  const d = { method: 'confirm', id: 'a', title: 't' } as const
  assert.deepEqual(dialogResponse(d, accept({ confirmed: false })), { id: 'a', confirmed: false })
  assert.deepEqual(dialogResponse(d, accept({ confirmed: 'yes' })), { id: 'a', cancelled: true })
})

test('dialogResponse: input without a value gives an empty string', () => {
  assert.deepEqual(dialogResponse({ method: 'input', id: 'a', title: 't' }, accept({})), { id: 'a', value: '' })
})

test('dialogResponse: decline, cancel and a failed request are cancelled', () => {
  const d = { method: 'input', id: 'a', title: 't' } as const
  for (const r of [{ action: 'decline' }, { action: 'cancel' }, null] as any[]) {
    assert.deepEqual(dialogResponse(d, r), { id: 'a', cancelled: true })
  }
})
