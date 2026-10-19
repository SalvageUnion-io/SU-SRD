import type { CSSProperties } from 'react'
import { borderWidth, fontSize, radius, space, weight } from '../../design/tokens'
import { useConnection } from '../../lib/connection/connectionContext'

/**
 * In the ground's own ink (`currentColor`): a state, not an outcome, so no
 * roll-tier or status colour (chrome K5, ruleset §3.4). It sits on a band or
 * on paper, and reads on either.
 */
const LOZENGE = {
  alignItems: 'center',
  borderColor: 'currentColor',
  borderRadius: radius.badge,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  display: 'inline-flex',
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  gap: space[6],
  paddingBlock: space[4],
  paddingInline: space[8],
  textTransform: 'uppercase',
} satisfies CSSProperties

/**
 * The in-place "this surface is read-only right now" lozenge (ADR-030 §1).
 *
 * ## Why a second thing next to `NotConnectedBanner`
 *
 * The banner is app-wide and says *why*: the connection is gone. This says
 * *what it costs you here*, and it sits where the edit affordance would be —
 * which is the question a player actually asks. Withdrawing a Share button and
 * leaving a gap invites the reading "the app is broken"; withdrawing it and
 * saying "read-only" in its place does not. It never restates the condition:
 * offline is one notice, in one wording, the banner's (chrome K5).
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
  const { canWrite, settling, mode, outdated } = useConnection()
  if (canWrite || settling) return null

  return (
    <span role="status" aria-live="polite" style={LOZENGE}>
      <span aria-hidden="true">◆</span>
      <span>
        {mode === 'solo'
          ? 'Read-only — sign in to edit'
          : outdated
            ? 'Read-only — updating'
            : 'Read-only for now'}
      </span>
    </span>
  )
}
