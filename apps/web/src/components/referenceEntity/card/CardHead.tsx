import type { ComponentProps, ReactNode } from 'react'
import { Head } from '../../entity'
import { EntityCardHeader } from './EntityCardHeader'

type CardHeadProps = ComponentProps<typeof EntityCardHeader> & {
  /** The Row's head in place of the flush band (every framed card: `ReferenceEntityCard`'s `cutOut`). */
  cutOut: boolean
  /** The card's controls: its chip group's last slot (C8, hard rule R6). Cut-out only. */
  controls?: ReactNode
  /** Select mode's seal, on the band's right (EDL Modes, R15). Cut-out only. */
  affordance?: ReactNode
}

/**
 * A framed card's head: its flush header band (`EntityCardHeader`), or, CUT
 * OUT, the Row's head (`entity/parts/Head`) in the card's own fill, foreground
 * and grain: the tier and name, the labels and the chip group (E17), its
 * controls the group's last slot, and select mode's seal. The name always sits
 * on the paper cut-out; unlike a Row's, its chips (a crew NPC's HP) stay on
 * the band right of it and wrap there.
 */
export function CardHead({ cutOut, controls, affordance, ...band }: CardHeadProps) {
  if (!cutOut) return <EntityCardHeader {...band} />
  return (
    <Head
      title={band.title}
      kind={band.kind}
      titleAs={band.titleAs}
      paint={{
        background: band.bandColor ?? 'var(--color-paper)',
        color: band.titleColor ?? 'var(--color-ink)',
        ink: band.fill === 'ink',
        nameOnPaper: false,
        ...(band.grain ? { grain: band.grain } : {}),
      }}
      tier={band.numeral}
      chips={band.chips}
      controls={controls}
      affordance={affordance}
      labels={band.labels}
      notch
      chipsBeside
    />
  )
}
