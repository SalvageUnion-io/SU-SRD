import type { CSSProperties } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { sharedCopy } from '../../messages/components-shared'
import { Banner, tokens } from '../index'

/**
 * The NOT CONNECTED banner (ADR-030 §1).
 *
 * Shown only in `disconnected` — signed in, but the server of record is
 * unreachable. It is deliberately **never** shown in Solo: somebody who never
 * signed in has a perfectly working local app, and telling them they are
 * disconnected would be a lie about the only thing this banner exists to say.
 *
 * The copy states the consequence rather than the condition, because "offline"
 * on its own does not tell a player why their edit did not stick. Writes are
 * blocked rather than queued, so the honest message is that this is read-only
 * until the connection returns.
 *
 * It is the shared `Banner` at its warn severity: the status-warn treatment
 * with ink text. Its own strip once set the warn ember as text on cream, which
 * measured 2.97 : 1, under the 4.5 : 1 body text needs.
 *
 * ## The one offline notice (chrome K5, hard rule R20)
 *
 * This is the only place the app words being offline. The in-place lozenge
 * (`WritesBlockedNotice`) says what it costs here, "Read Only"; a
 * refused write's toast says what happened to that change. Neither restates
 * the condition, and `chrome/offline-copy` fails a second wording.
 */

const STRIP = {
  backgroundColor: tokens.color.wkBg,
  padding: `${tokens.space[6]} ${tokens.space[12]}`,
} satisfies CSSProperties

const NOT_CONNECTED = [
  {
    severity: 'warn' as const,
    message: sharedCopy('notConnectedYourGamesAre'),
  },
]

export function NotConnectedBanner() {
  const { showDisconnectedWarning } = useConnection()
  if (!showDisconnectedWarning) return null

  return (
    <div style={STRIP}>
      <Banner warnings={NOT_CONNECTED} />
    </div>
  )
}
