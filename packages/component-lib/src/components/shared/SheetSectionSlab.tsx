/**
 * SheetSectionSlab — the UNFRAMED live-sheet section container: a `Slab`
 * leader (solid black-stamp title + count + rule + controls) with its content
 * sitting straight on the sheet ground.
 *
 * It is the sibling of `SheetSectionCard`, and the pair encodes one rule for
 * the live sheets:
 *
 *   - a section of INPUTS and/or GAUGES is contained by a CARD
 *     (`SheetSectionCard` — accent frame, header band, paper body: the region
 *     is a form, so it gets a form's enclosure);
 *   - a section of ENTITY CARDS is contained by a SLAB (this component — a
 *     label and a rule, nothing more).
 *
 * The reason is nesting, not taste. Entity cards already carry their own 3px
 * frame, header band and paper body, so framing a grid of them in a second
 * frame stacks two identical enclosures and reads as one large opaque block —
 * the "blocky group" this container exists to undo. A slab announces the
 * region and then gets out of the cards' way.
 *
 * The API is deliberately `SheetSectionCard`'s (title / count / controls /
 * children) so a section moves between the two containers by changing the
 * element name and nothing else.
 *
 * Composes the existing `Slab` (variant 'solid' — the poster `.sect` shape)
 * rather than restating its markup, so the leader stays one implementation.
 */

import type { ReactNode } from 'react'
import { Slab } from '../chrome/Slab'
import { cn } from '../../utils/cn'

type SheetSectionSlabProps = {
  /** Section title — the solid black stamp in the slab leader. */
  title: string
  /**
   * Optional count/meta after the title, e.g. `4/6 slots`. Rendered in the
   * slab's muted count position (not a framed tag — the slab has no band to
   * hold one).
   */
  count?: ReactNode
  /** Trailing controls after the leader rule (the section's '+ Add' / Edit). */
  controls?: ReactNode
  /** Extra classes on the section wrapper (e.g. a grid-span). */
  className?: string
  /** Extra classes on the content block (e.g. grid gaps). */
  bodyClassName?: string
  children: ReactNode
}

/** Slab-led, unframed section container for entity-card collections. */
export function SheetSectionSlab({
  title,
  count,
  controls,
  className,
  bodyClassName,
  children,
}: SheetSectionSlabProps) {
  return (
    // `.sheet-section` keeps the print page-break rule the card container also
    // carries, so moving a section between the two never changes pagination.
    <section className={cn('sheet-section', className)}>
      {/* `flex-wrap`: the slab leader is one flex row of shrink-0 parts (stamp,
          count, rule, controls). A long title beside a long control — e.g.
          "Armament Bay Weapons" + "+ Add weapons system" — is 432px of content
          in a 350px column at 390px viewport, which overflowed the sheet
          sideways (measured, not assumed). Wrapping drops the controls to
          their own line instead; the card container never had this problem
          because its header band is a separate `ml-auto` row. */}
      <Slab variant="solid" label={title} count={count} actions={controls} className="flex-wrap" />
      <div className={cn('min-w-0', bodyClassName)}>{children}</div>
    </section>
  )
}
