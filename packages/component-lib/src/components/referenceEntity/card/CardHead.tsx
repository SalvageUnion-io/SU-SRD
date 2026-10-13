import type { ComponentProps } from 'react'
import { Head } from '../../../entity/parts/Head'
import { EntityCardHeader } from './EntityCardHeader'

type CardHeadProps = ComponentProps<typeof EntityCardHeader> & {
  /** The Row's head in place of the flush band (`ReferenceEntityCardProps.cutOut`). */
  cutOut: boolean
}

/**
 * A framed card's head: its flush header band (`EntityCardHeader`), or, CUT
 * OUT, the Row's head (`entity/parts/Head`) in the card's own fill, foreground
 * and grain: the tier and name, the labels, the chip group (E17) and the
 * pennant button. The name always sits on the paper cut-out; unlike a Row's,
 * its chips (a crew NPC's HP) stay on the band right of it and wrap there.
 */
export function CardHead({ cutOut, ...band }: CardHeadProps) {
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
      pennant={band.pennant}
      labels={band.labels}
      notch
      chipsBeside
    />
  )
}
