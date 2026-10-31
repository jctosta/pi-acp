import test from 'node:test'
import assert from 'node:assert/strict'
import { todoPlanEntries } from '../../src/acp/translate/todo-plan.js'

const result = (tasks: unknown, extra: object = {}) => ({ content: [], details: { action: 'list', tasks, ...extra } })

test('todoPlanEntries: subjects, statuses, no deleted tasks, medium priority', () => {
  const r = result([
    { id: 1, subject: 'Read', status: 'completed' },
    { id: 2, subject: 'Write', status: 'in_progress', activeForm: 'Writing' },
    { id: 3, subject: 'Gone', status: 'deleted' },
    { id: 4, subject: 'Test', status: 'pending' }
  ])
  assert.deepEqual(todoPlanEntries('todo', r, false), [
    { content: 'Read', priority: 'medium', status: 'completed' },
    { content: 'Write', priority: 'medium', status: 'in_progress' },
    { content: 'Test', priority: 'medium', status: 'pending' }
  ])
})

test('todoPlanEntries: clear gives an empty plan', () => {
  assert.deepEqual(todoPlanEntries('todo', result([]), false), [])
})

test('todoPlanEntries: errors and other tools give no plan', () => {
  const ok = result([{ subject: 'a', status: 'pending' }])
  assert.equal(todoPlanEntries('todo', ok, true), null)
  assert.equal(todoPlanEntries('read', ok, false), null)
  assert.equal(todoPlanEntries('todo', result([], { error: 'bad' }), false), null)
  assert.equal(todoPlanEntries('todo', { details: {} }, false), null)
  assert.equal(todoPlanEntries('todo', undefined, false), null)
})

test('todoPlanEntries: tasks without a subject or a known status are dropped', () => {
  const r = result([{ subject: 1, status: 'pending' }, { subject: 'x', status: 'weird' }, null])
  assert.deepEqual(todoPlanEntries('todo', r, false), [])
})
