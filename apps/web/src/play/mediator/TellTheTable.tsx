/**
 * TellTheTable — a word to every player at once, from the Mediator's Play bar
 * (docs/architecture/play.md §15): `proposals.broadcast`, which
 * every player reads on their Feed. Under the form, the last five alerts sent.
 *
 * Presentational: the Mediator's screen sends, and says why when the server
 * refuses.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import {
  Button,
  EmptyState,
  Eyebrow,
  FeedLine,
  FeedList,
  FeedTime,
  Field,
  Input,
  tokens,
} from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import type { AlertLine } from '../useGameFeed'

const { space } = tokens

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
      // The caller has already said why; the message stays to send again.
      .catch(() => undefined)
      .finally(() => setSending(false))
  }

  return (
    <div style={SCROLL}>
      <Eyebrow as="h3" tone="muted">
        {mediatorCopy('everyPlayerSeesThisOn')}
      </Eyebrow>
      <div style={FORM}>
        <Field label={mediatorCopy('alert')} htmlFor={`${id}-alert`}>
          <Input
            id={`${id}-alert`}
            value={message}
            placeholder={mediatorCopy('contactFrontTwoSquads')}
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
          {mediatorCopy('send')}
        </Button>
      </div>
      {alerts.length === 0 ? (
        <EmptyState variant="quiet" body={mediatorCopy('nothingSentYet')} />
      ) : (
        <FeedList label={mediatorCopy('sentToTheTable')}>
          {alerts.slice(0, 5).map((a) => (
            <FeedLine key={a._id} end={<FeedTime ts={a.ts} format="ago" now={now} />}>
              {a.message}
            </FeedLine>
          ))}
        </FeedList>
      )}
    </div>
  )
}
