/**
 * PublicNextSteps — where a shared pilot's page ends for a reader with no
 * account (r7 G9): build a pilot of your own, or try a round in Play with a
 * Starter Set pilot, saved nowhere (`PlayTrial`). A friend opening the link
 * is never left at a dead end. Loaded only for that reader (`PublicSheet`).
 */

import { cockpitPath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { Button, tokens } from '../../components/index'
import { appPath } from '../../lib/appBase'
import { STARTER_ROSTERS } from '../../lib/starterSet/starterTemplates'
import { buildSheetCopy } from '../../messages/build-sheet'
import { playTrialCopy } from '../../messages/play-trial'

/** Its side gutter is the page's (`.su-sheet-public-next`). */
const STEPS = {
  backgroundColor: tokens.color.wkBg,
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  justifyContent: 'center',
} satisfies CSSProperties

export function PublicNextSteps() {
  const trial = STARTER_ROSTERS[0]?.pilots[0]?.id
  return (
    <nav
      aria-label={buildSheetCopy('yourNextStep')}
      className="su-page-gutters su-sheet-public-next"
      style={STEPS}
    >
      <Button href="/pilots/new" variant="primary" size="full">
        {buildSheetCopy('buildYourOwnPilot')}
      </Button>
      {trial && (
        <Button href={appPath(cockpitPath(trial))} size="full">
          {playTrialCopy('tryARound')}
        </Button>
      )}
    </nav>
  )
}
