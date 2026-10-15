/**
 * TellTheTable — a word to every player at once, from the Mediator Dashboard
 * (docs/architecture/mediator-dashboard.md Q14): `proposals.broadcast`, which
 * every player reads on their Dashboard's strip and Log tab. Under the form,
 * the last five alerts sent.
 *
 * Presentational: the Dashboard sends, and says why when the server refuses.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { Button, EmptyState, Field, Input, tokens } from '../../../ui/index'
import type { AlertLine } from '../dashboard/useGameFeed'
import { BODY, EYEBROW, MUTED, NUMBERS } from './mediatorStyles.model'
import { ago } from './proposalLine.model'

const { borderWidth, color, radius, space } = tokens

const SCROLL = {
  height: '100%',
  overflowY: 'auto',
  padding: space[12],
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties

const FORM = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: space[8],
  alignItems: 'end',
} satisfies CSSProperties

const LIST = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

const ROW = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: space[12],
  padding: `${space[6]} ${space[10]}`,
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink20}`,
  borderRadius: radius.card,
} satisfies CSSProperties

const WHEN = { ...MUTED, ...NUMBERS, whiteSpace: 'nowrap' } satisfies CSSProperties

export function TellTheTable({
  alerts,
  now,
  canWrite,
  onSend,
}: {
  alerts: readonly AlertLine[]
  now: number
  canWrite: boolean
  /** Resolves once sent; rejects with the server's refusal (already explained). */
  onSend: (message: string) => Promise<void>
}) {
  const id = useId()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const send = () => {
    setSending(true)
    void onSend(message.trim())
      .then(() => setMessage(''))
      // The Dashboard has already said why; the message stays to send again.
      .catch(() => undefined)
      .finally(() => setSending(false))
  }

  return (
    <div style={SCROLL}>
      <h3 style={EYEBROW}>Every player sees this on their Dashboard</h3>
      <div style={FORM}>
        <Field label="Alert" htmlFor={`${id}-alert`}>
          <Input
            id={`${id}-alert`}
            value={message}
            placeholder="Contact front, two squads"
            disabled={!canWrite}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && message.trim() !== '' && canWrite) send()
            }}
          />
        </Field>
        <Button
          variant="primary"
          size="compact"
          disabled={!canWrite || sending || message.trim() === ''}
          onClick={send}
        >
          Send
        </Button>
      </div>
      {alerts.length === 0 ? (
        <EmptyState variant="quiet" body="Nothing sent yet." />
      ) : (
        <ul style={LIST} aria-label="Sent to the table">
          {alerts.slice(0, 5).map((a) => (
            <li key={a._id} style={ROW}>
              <span style={BODY}>{a.message}</span>
              <span style={WHEN}>{ago(a.ts, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
