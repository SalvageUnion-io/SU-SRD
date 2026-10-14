import type { ReactNode } from 'react'
import { Head } from './Head'

type CutOutHeadProps = {
  title: string
  /** The band's fill: `ink` (the default) or a tone colour, e.g. `var(--tone)`. */
  background?: string
  /** What rides the band right of the name (a meta line, chips). */
  aside?: ReactNode
}

/**
 * The standard card head for a card that is not an entity (a sheet's Hold):
 * the same cut-out an entity card wears (`CardHead cutOut`) — the name on the
 * paper tab notched into the band's foot — with whatever rides beside it.
 * Pass it to `Card`'s `head` slot.
 */
export function CutOutHead({ title, background, aside }: CutOutHeadProps) {
  const ink = background === undefined
  return (
    <Head
      title={title}
      paint={{
        background: background ?? 'var(--color-ink)',
        color: ink ? 'var(--color-paper)' : 'var(--color-ink)',
        ink,
        nameOnPaper: false,
      }}
      chips={aside}
      notch
      chipsBeside
    />
  )
}
