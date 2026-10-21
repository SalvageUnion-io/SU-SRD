import type { ReactNode } from 'react'
import { Head } from '../../entity'
import type { HeaderFill } from './cardChrome'
import type { CardGrain } from './cardGrain'
import type { CardTitleTag } from './referenceEntityCardTypes'

type CardHeadProps = {
  title: string
  /** The name as a link to its own Page (`CardTitleLink`). */
  titleContent?: ReactNode
  /** The entity's kind, for screen readers only (`KindLabel`): never a stamp. */
  kind?: string
  /** The title's element (`ReferenceEntityCardProps.titleAs`). */
  titleAs?: CardTitleTag
  /** TONE (things you have) or INK (things you do) — see `HeaderFill`. */
  fill: HeaderFill
  /** The band's fill as a CSS colour; `undefined` leaves it paper. */
  bandColor: string | undefined
  /** On-band text colour (ink or paper), resolved by contrast. */
  titleColor?: string
  /** An ability's tier numeral, at the band's left. */
  numeral?: string
  /** The entity's chip group (`Chips`, E17). */
  chips?: ReactNode
  /** The card's controls: its chip group's last slot (C8, hard rule R6). */
  controls?: ReactNode
  /** Select mode's seal, on the band's right (EDL Modes, R15). */
  affordance?: ReactNode
  /** The light speckle (ruleset §3.5) — `ink` on a tone, `paper` on ink. */
  grain?: CardGrain
  /** Where the chips that do not fit beside the name go (`Head`'s, C2b). */
  overflow?: 'body' | 'more'
}

/**
 * A framed card's head: the Compact's cut-out head (`entity/parts/Head`) in
 * the card's own fill, foreground and grain: the tier and name, the chip
 * group (E17), its controls the group's last slot, and select mode's seal.
 * The name always sits on the paper cut-out; unlike a Compact's, its chips (a
 * crew NPC's HP) stay on the band right of it and wrap there.
 */
export function CardHead({
  title,
  titleContent,
  kind,
  titleAs,
  fill,
  bandColor,
  titleColor,
  numeral,
  chips,
  controls,
  affordance,
  grain,
  overflow,
}: CardHeadProps) {
  return (
    <Head
      title={title}
      titleContent={titleContent}
      kind={kind}
      titleAs={titleAs}
      paint={{
        background: bandColor ?? 'var(--color-paper)',
        color: titleColor ?? 'var(--color-ink)',
        ink: fill === 'ink',
        nameOnPaper: false,
        ...(grain ? { grain } : {}),
      }}
      tier={numeral}
      chips={chips}
      controls={controls}
      affordance={affordance}
      overflow={overflow}
    />
  )
}
