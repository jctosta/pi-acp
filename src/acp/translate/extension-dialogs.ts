import type { CreateElicitationRequest, CreateElicitationResponse } from '@agentclientprotocol/sdk'

export type PiDialog =
  | { method: 'select'; id: string; title: string; options: string[] }
  | { method: 'confirm'; id: string; title: string; message?: string }
  | { method: 'input'; id: string; title: string; placeholder?: string }
  | { method: 'editor'; id: string; title: string; prefill?: string }

type PiDialogAnswer =
  | { id: string; value: string }
  | { id: string; confirmed: boolean }
  | { id: string; cancelled: true }

/** The first paragraph of pi's dialog title (up to the first blank line) and the rest. */
export function splitDialogTitle(title: string): { message: string; detail: string | null } {
  const m = /\r?\n[ \t]*\r?\n/.exec(title)
  if (!m) return { message: title, detail: null }
  const detail = title.slice(m.index + m[0].length).trim()
  return { message: title.slice(0, m.index), detail: detail || null }
}

/** The elicitation/create params for a dialog. */
export function dialogElicitation(sessionId: string, dialog: PiDialog): CreateElicitationRequest {
  const { message, detail } = splitDialogTitle(dialog.title)
  const description = detail ?? undefined
  const form = (properties: Record<string, any>, required?: string[]): CreateElicitationRequest => ({
    mode: 'form',
    sessionId,
    message,
    requestedSchema: { type: 'object', properties, ...(required ? { required } : {}) }
  })

  switch (dialog.method) {
    case 'select':
      return form(
        {
          choice: {
            type: 'string',
            description,
            oneOf: dialog.options.map((o, i) => ({ const: String(i), title: o }))
          }
        },
        ['choice']
      )
    case 'confirm':
      return form(
        {
          confirmed: {
            type: 'boolean',
            description: [detail, dialog.message].filter(Boolean).join('\n\n') || undefined
          }
        },
        ['confirmed']
      )
    case 'input':
      return form({
        value: {
          type: 'string',
          description,
          ...(dialog.placeholder ? { _meta: { piAcp: { placeholder: dialog.placeholder } } } : {})
        }
      })
    case 'editor':
      return form({
        value: {
          type: 'string',
          description,
          default: dialog.prefill ?? '',
          _meta: { piAcp: { multiline: true } }
        }
      })
  }
}

/** pi's extension_ui_response for the client's reply (without type). */
export function dialogResponse(dialog: PiDialog, reply: CreateElicitationResponse | null): PiDialogAnswer {
  const { id } = dialog
  const cancelled = { id, cancelled: true as const }
  if (!reply || reply.action !== 'accept') return cancelled
  const content = reply.content ?? {}

  switch (dialog.method) {
    case 'select': {
      const choice = content.choice
      const i = typeof choice === 'string' && /^\d+$/.test(choice) ? Number(choice) : -1
      const value = dialog.options[i]
      return value === undefined ? cancelled : { id, value }
    }
    case 'confirm':
      return typeof content.confirmed === 'boolean' ? { id, confirmed: content.confirmed } : cancelled
    default:
      return { id, value: typeof content.value === 'string' ? content.value : '' }
  }
}
