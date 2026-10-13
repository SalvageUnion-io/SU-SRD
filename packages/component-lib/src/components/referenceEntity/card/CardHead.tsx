import type { ComponentProps } from 'react'
import { Head } from '../../../entity/parts/Head'
import { EntityCardHeader } from './EntityCardHeader'

type CardHeadProps = ComponentProps<typeof EntityCardHeader> & {
  /** The Row's head in place of the flush band (`ReferenceEntityCardProps.cutOut`). */
  cutOut: boolean
}

/**
 * A framed card's head: its flush header band (`EntityCardHeader`), or, CUT
 * OUT, the Row's head (`entity/parts/Head`) — the tier and name notched on the
 * paper cut-out, the labels, action-type stamps and pennant on the band, in
 * the card's own fill, foreground and grain. A cut-out head carries no value
 * cells: they lead the facts row under it (`withHeadFacts`), as a bodied Row's.
 */
export function CardHead({ cutOut, ...band }: CardHeadProps) {
  if (!cutOut) return <EntityCardHeader {...band} />
  return (
    <Head
      title={band.title}
      titleAs={band.titleAs}
      paint={{
        background: band.bandColor ?? 'var(--color-paper)',
        color: band.titleColor ?? 'var(--color-ink)',
        ink: band.fill === 'ink',
        nameOnPaper: false,
        ...(band.grain ? { grain: band.grain } : {}),
      }}
      tier={band.numeral}
      stamps={band.stamps}
      pennant={band.pennant}
      labels={band.labels}
      notch
    />
  )
}
