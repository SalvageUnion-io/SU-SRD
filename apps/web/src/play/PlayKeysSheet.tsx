/**
 * The keys sheet (r6 A13): what "?" opens on a Play screen, the keys a turn
 * takes. Its own module, loaded when it is first asked for, so the screen's
 * chunk does not carry it (`PlayActionsTools`).
 */

import type { CSSProperties } from 'react'
import { ModalShell, Stat, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { playKeysCopy } from '../messages/play-keys'

const LIST = { display: 'grid', gap: tokens.space[6] } satisfies CSSProperties

/** Mediate's keys (r8 B10, `useMediatorKeys`). */
const MEDIATOR_KEYS = [
  ['T', playKeysCopy('keyTell')],
  ['R', playKeysCopy('keyRollNpc')],
  ['N', playKeysCopy('keyNextSide')],
  ['?', playCopy('keyThisSheet')],
] as const

export function PlayKeysSheet({
  onClose,
  mediator = false,
}: {
  onClose: () => void
  /** Mediate's keys, not a player's turn's (r8 B10). */
  mediator?: boolean
}) {
  // Each key and what it presses, a Stat (ruleset §3.7).
  const player = [
    ['/', playCopy('keyFind')],
    [playKeysCopy('keyRulesCap'), playKeysCopy('keyRules')],
    ['R', playCopy('keyRoll')],
    ['A', playCopy('keyApply')],
    ['E', playCopy('keyEndTurn')],
    ['N', playCopy('keyNotice')],
    ['?', playCopy('keyThisSheet')],
  ] as const
  const keys = mediator ? MEDIATOR_KEYS : player
  return (
    <ModalShell
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={playCopy('playKeys')}
    >
      <div style={LIST}>
        {keys.map(([key, what]) => (
          <Stat key={key} label={key} value={what} size="compact" wrap />
        ))}
      </div>
    </ModalShell>
  )
}
