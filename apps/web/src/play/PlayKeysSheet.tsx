/**
 * The keys sheet (r6 A13): what "?" opens on a Play screen, the keys a turn
 * takes. Its own module, loaded when it is first asked for, so the screen's
 * chunk does not carry it (`PlayActionsTools`).
 */

import type { CSSProperties } from 'react'
import { ModalShell, Stat, tokens } from '../components/index'
import { playCopy } from '../messages/play'

const LIST = { display: 'grid', gap: tokens.space[6] } satisfies CSSProperties

export function PlayKeysSheet({ onClose }: { onClose: () => void }) {
  // Each key and what it presses, a Stat (ruleset §3.7).
  const keys = [
    ['/', playCopy('keyFind')],
    [playCopy('keyRulesCap'), playCopy('keyRules')],
    ['R', playCopy('keyRoll')],
    ['A', playCopy('keyApply')],
    ['E', playCopy('keyEndTurn')],
    ['N', playCopy('keyNotice')],
    ['?', playCopy('keyThisSheet')],
  ] as const
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
