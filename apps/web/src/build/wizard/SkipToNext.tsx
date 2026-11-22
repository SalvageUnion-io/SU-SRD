/**
 * A picking step's way past its detail card to Next (r5 C6): off screen until
 * the focus reaches it, between the choice and the card, so a keyboard
 * reader steps to Next without passing the card's links. A locked Next takes
 * no focus; the step's own note says why, so it goes there.
 */

import { useState } from 'react'
import { capsLabel } from '../../components/index'
import { cn } from '../../lib/cn'
import { buildWizardCopy } from '../../messages/build-wizard'

/** The skip link's face once focused; till then clipped where it stands (K14). */
const SKIP = cn('su-skip-link', capsLabel())

/** The wizard's Next (`WizShell`'s primary action). */
// biome-ignore lint/style/useComponentExportOnlyModules: the id the skip lands on, beside it
export const WIZ_NEXT_ID = 'wiz-next'

export function SkipToNext() {
  const [shown, setShown] = useState(false)
  return (
    <a
      href={`#${WIZ_NEXT_ID}`}
      className={shown ? SKIP : 'su-sr-only'}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
      onClick={(event) => {
        event.preventDefault()
        const next = document.getElementById(WIZ_NEXT_ID)
        if (next instanceof HTMLButtonElement && !next.disabled) next.focus()
        else document.getElementById('wiz-step-note')?.scrollIntoView?.({ block: 'nearest' })
      }}
    >
      {buildWizardCopy('skipToNext')}
    </a>
  )
}
