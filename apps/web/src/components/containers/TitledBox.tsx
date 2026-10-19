import type { ElementType, ReactNode } from 'react'
import type { Paint } from '../entity'
import { Head, paintFor } from '../entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import type { BoxProps } from './Box'
import { Box } from './Box'

type TitledBoxProps = Omit<BoxProps, 'head' | 'frameColor'> & {
  /** The name on the cut-out; it also names a `section`. */
  title: string
  /** What the cut-out shows in place of `title`'s text: a live sheet's inline-edit field. */
  titleContent?: ReactNode
  /** The title's element (`h1` where the box is the screen's subject). */
  titleAs?: ElementType
  /** A step's number: an ink chip butted against the cut-out, at its left. */
  number?: string
  /** The band's tone token (`--color-<tone>`), or `ink` (the default). */
  tone?: string
  /** A paint already resolved (a surface's `--tone`), in place of `tone`'s. */
  paint?: Paint
  /** One group on the band right of the name (E17), wrapping in its own column. */
  chips?: ReactNode
  /** The band's trailing controls (a dialog's ×). */
  controls?: ReactNode
}

/**
 * TITLED BOX — the `Box` with the house cut-out head: a band in the box's
 * tone, the title notched into its foot on a square paper tab in ink (ruleset,
 * "Chapter band"), chips beside it on the band and controls at its end. The
 * tab opens into the paper body with no rule between them.
 *
 * Every titled container that is not an entity wears it: dialogs
 * (`ModalShell`), sheet panels (`Inset`, `InfoCutout`), wizard briefs,
 * notices. Entities draw through their own forms (`Row`,
 * `ReferenceEntityCard`), which share the same `Head`.
 *
 * Where it may not go (ruleset §5, N5 and N6): inside an entity's Card or
 * Row, where a section of the entity is a `Slab` over content and a note an
 * unlabelled `Callout`; nor around a wizard step's entities, since the step is
 * its title over its content. On an SRD Page a block at level 1 (a bay's When
 * Damaged) may stay one.
 */
export function TitledBox({
  title,
  titleContent,
  titleAs,
  number,
  tone = 'ink',
  paint: paintProp,
  chips,
  controls,
  label,
  ...box
}: TitledBoxProps) {
  const surface = useEntitySurface()
  const paint = paintProp ?? paintFor(tone, { texture: surface.texture })
  return (
    <Box
      {...box}
      label={label ?? title}
      head={
        <Head
          title={title}
          titleContent={titleContent}
          titleAs={titleAs}
          tier={number}
          tierChip
          paint={paint}
          chips={chips}
          controls={controls}
          notch
          chipsBeside
        />
      }
    />
  )
}
