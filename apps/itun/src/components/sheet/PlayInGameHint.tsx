/**
 * PlayInGameHint — what a shelf sheet shows where the Dashboard launcher was.
 *
 * The Dashboard opens only for a pilot in a Game that has a Mediator
 * (ADR-038 §1), from the Play button on the Game's roster. A build on the
 * shelf is edited here, on its live sheet, so the sheet says where play
 * happens instead of offering a launch that would be refused.
 */

import { Text, tokens } from 'component-lib'
import type { CSSProperties } from 'react'

const HINT = {
  color: tokens.color.wkMuted,
  fontSize: tokens.fontSize.xs,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function PlayInGameHint() {
  return (
    <Text
      variant="hint"
      as="span"
      style={HINT}
      title="The Dashboard opens from a Game's roster, in a Game with a Mediator."
    >
      Play in a Game
    </Text>
  )
}
