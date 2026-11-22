/**
 * The keys sheet (r6 A13): what "?" opens on a Play screen, the keys a turn
 * takes. Its own module, loaded when it is first asked for, so the screen's
 * chunk does not carry it (`PlayActionsTools`).
 */

import type { CSSProperties } from 'react'
import { capsLabel, ModalShell, tokens } from '../components/index'
import { playCopy } from '../messages/play'

const LIST = {
  display: 'grid',
  gap: `${tokens.space[6]} ${tokens.space[12]}`,
  gridTemplateColumns: 'auto 1fr',
  margin: 0,
} satisfies CSSProperties

const WHAT = { margin: 0 } satisfies CSSProperties

const KEYS = [
  ['/', 'keyFind'],
  ['R', 'keyRoll'],
  ['A', 'keyApply'],
  ['E', 'keyEndTurn'],
  ['?', 'keyThisSheet'],
] as const

export function PlayKeysSheet({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={playCopy('playKeys')}
    >
      <dl style={LIST}>
        {KEYS.map(([key, what]) => (
          <div key={key} style={{ display: 'contents' }}>
            <dt>
              <kbd className={capsLabel({ size: 'badge' })}>{key}</kbd>
            </dt>
            <dd style={WHAT}>{playCopy(what)}</dd>
          </div>
        ))}
      </dl>
    </ModalShell>
  )
}
