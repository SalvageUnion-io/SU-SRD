import { useConnection } from '../../lib/connection/connectionContext'

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
 */
export function NotConnectedBanner() {
  const { showDisconnectedWarning } = useConnection()
  if (!showDisconnectedWarning) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b-2 border-[var(--color-roll-failure)] bg-[var(--color-band-cream)] px-3 py-1.5 text-center font-[var(--font-cond)] text-xs font-bold tracking-wider text-[var(--color-roll-failure)] uppercase"
    >
      <span aria-hidden="true">◆</span>
      <span>Not connected — your games are read-only until the connection returns</span>
    </div>
  )
}
