import type { PlanEntry } from '@agentclientprotocol/sdk'

const STATUSES = new Set(['pending', 'in_progress', 'completed'])

/** The plan for a successful rpiv-todo `todo` result, or null when this is not one. */
export function todoPlanEntries(toolName: string, result: unknown, isError: boolean): PlanEntry[] | null {
  if (toolName !== 'todo' || isError) return null
  const details = (result as { details?: unknown } | null | undefined)?.details
  if (!details || typeof details !== 'object' || (details as { error?: unknown }).error) return null
  const tasks = (details as { tasks?: unknown }).tasks
  if (!Array.isArray(tasks)) return null

  const entries: PlanEntry[] = []
  for (const t of tasks) {
    if (typeof t?.subject !== 'string' || !STATUSES.has(t.status)) continue
    entries.push({ content: t.subject, priority: 'medium', status: t.status })
  }
  return entries
}
