import type { CSSProperties } from 'react'
import { sharedCopy } from '../../messages/components-shared'
import { useSync } from '../../replica/syncContext'
import { Badge } from '../atoms/Badge'
import { tokens } from '../index'

/**
 * The sync badge (ADR-030 §1): the bar's one word on the connection, and the
 * only place the app words being offline (chrome K5, hard rule R20).
 *
 * Shown only while a session cannot write: `offline` (signed in, the server
 * unreachable) or `outdated` (this tab is updating to a new build). It is
 * never shown signed out, where there is nothing to be disconnected from and
 * the bar offers sign-in instead, nor while `syncing`, the sub-second
 * handshake every load passes through: a badge that flashes on every load
 * trains people to ignore it.
 *
 * It says it short and carries the full wording, the consequence rather than
 * the condition, as its name. On a phone the bar's row has room for the
 * avatar and no more, so there it is a `dot` on the avatar's corner, with the
 * same name. A surface that cannot write says nothing of its own: it
 * withdraws its edit affordance, and a refused write's toast says what
 * happened to that change.
 */

const DOT = {
  backgroundColor: tokens.color.statusWarn,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  borderRadius: tokens.radius.badge,
  height: tokens.space[12],
  pointerEvents: 'none',
  position: 'absolute',
  right: `-${tokens.space[4]}`,
  top: `-${tokens.space[4]}`,
  width: tokens.space[12],
} satisfies CSSProperties

export function SyncBadge({ dot = false }: { dot?: boolean }) {
  const { status, outdated } = useSync()
  if (status === 'signedOut' || status === 'syncing') return null
  if (status === 'live' && !outdated) return null

  const short = outdated ? sharedCopy('readOnlyUpdating') : sharedCopy('offlineReadOnly')
  const full = outdated ? short : sharedCopy('notConnectedYourGamesAre')
  if (dot) return <span role="status" aria-label={full} title={full} style={DOT} />
  return (
    <Badge tone="warn" surface="tone" role="status" aria-label={full} title={full}>
      {short}
    </Badge>
  )
}
