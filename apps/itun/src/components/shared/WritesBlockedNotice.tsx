import { useConnection } from '../../lib/connection/connectionContext'

/**
 * The in-place "this surface is read-only right now" lozenge (ADR-030 §1).
 *
 * ## Why a second thing next to `NotConnectedBanner`
 *
 * The banner is app-wide and says *why*: the connection is gone. This says
 * *what it costs you here*, and it sits where the edit affordance used to be —
 * which is the question a player actually asks. Withdrawing a Share button and
 * leaving a gap invites the reading "the app is broken"; withdrawing it and
 * saying "read-only — not connected" in its place does not.
 *
 * ## Deliberately silent while the session is settling
 *
 * `settling` is the sub-second initial auth handshake. Writes are refused then
 * too (see `writesAllowed`), but flashing a read-only lozenge on every single
 * load would train people to ignore it — and by the time they read it, it is
 * gone. A write attempted in that window is refused with its own toast instead,
 * which is the honest place to spend the interruption.
 */
export function WritesBlockedNotice() {
  const { canWrite, settling } = useConnection()
  if (canWrite || settling) return null

  // Plain class string rather than `cn()`, matching NotConnectedBanner: there is
  // nothing to merge here, and cn's tailwind-merge must have every custom
  // utility registered or it treats an unknown `text-*`/`tracking-*` as a colour
  // and strips the real one.
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-badge border-2 border-[var(--color-roll-failure)] px-2 py-1 text-badge font-bold uppercase text-[var(--color-roll-failure)]"
    >
      <span aria-hidden="true">◆</span>
      <span>Read-only — not connected</span>
    </span>
  )
}
