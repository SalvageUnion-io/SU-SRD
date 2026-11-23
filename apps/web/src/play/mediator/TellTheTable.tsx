/**
 * TellTheTable — a word to every player at once, from the Mediator's Play bar
 * (docs/architecture/play.md §15): `changeLog.broadcast`, which
 * every player reads on their Feed. Under the form, the last five alerts
 * sent, each with Withdraw (r4 B4, `changeLog.withdrawAlert`): it comes off
 * every player's strip and the Feed says it was withdrawn. To correct one,
 * withdraw it and send again. Once sent, the dialog closes (`onSent`, r6 B9):
 * a mid-fight shout costs no Esc, and focus goes back where it was opened from.
 *
 * An unsent draft is kept in the tab (`sessionStorage`, by Game) until
 * it is sent or cleared, so a refresh never loses it (r7 C14, MD7-23).
 *
 * Presentational: the Mediator's screen sends, and says why when the server
 * refuses.
 */

import type { CSSProperties, RefObject } from 'react'
import { useId, useState } from 'react'
import { FeedLine, FeedList, FeedTime } from '../../components/app'
import { Button, EmptyState, Eyebrow, Field, Input, tokens } from '../../components/index'
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

/** A sent alert's end: when, then Withdraw. */
const END = { alignItems: 'center', display: 'inline-flex', gap: space[8] } satisfies CSSProperties

/** The tab's draft store; null where there is none (a test, a private mode that refuses). */
function tabStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function readDraft(key: string | undefined): string {
  if (key === undefined) return ''
  try {
    return tabStore()?.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function keepDraft(key: string | undefined, text: string): void {
  if (key === undefined) return
  try {
    if (text === '') tabStore()?.removeItem(key)
    else tabStore()?.setItem(key, text)
  } catch {
    // A refused store keeps nothing: the draft lives only on screen.
  }
}

const FORM = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: space[8],
  alignItems: 'end',
} satisfies CSSProperties

/** A Game's Tell the table draft, in this tab. */
const draftKeyOf = (gameId: string | undefined) =>
  gameId === undefined ? undefined : `su:tell-the-table:${gameId}`

export function TellTheTable({
  alerts,
  now,
  canWrite,
  onSend,
  onWithdraw,
  onSent,
  field,
  gameId,
}: {
  alerts: readonly AlertLine[]
  now: number
  canWrite: boolean
  /** Resolves once sent; rejects with the server's refusal (already explained). */
  onSend: (message: string) => Promise<void>
  /** Take one back (the caller says a refusal). */
  onWithdraw: (alertId: string) => void
  /** Sent: the dialog around it closes (r6 B9). */
  onSent?: () => void
  /** The alert's field, for the dialog around it to open on (MD2-04). */
  field?: RefObject<HTMLInputElement | null>
  /** The Game whose unsent draft this tab keeps; none keeps nothing. */
  gameId?: string
}) {
  const id = useId()
  const draftKey = draftKeyOf(gameId)
  const [message, setMessageNow] = useState(() => readDraft(draftKey))
  const setMessage = (text: string) => {
    setMessageNow(text)
    keepDraft(draftKey, text)
  }
  const [sending, setSending] = useState(false)
  const send = () => {
    setSending(true)
    void onSend(message.trim())
      .then(() => {
        setMessage('')
        onSent?.()
      })
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
            ref={field}
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
            <FeedLine
              key={a._id}
              end={
                <span style={END}>
                  <FeedTime ts={a.ts} format="ago" now={now} />
                  <Button
                    size="mini"
                    disabled={!canWrite}
                    aria-label={mediatorCopy('withdrawWhat', { what: a.message })}
                    onClick={() => onWithdraw(a._id)}
                  >
                    {mediatorCopy('withdraw')}
                  </Button>
                </span>
              }
            >
              {a.message}
            </FeedLine>
          ))}
        </FeedList>
      )}
    </div>
  )
}
