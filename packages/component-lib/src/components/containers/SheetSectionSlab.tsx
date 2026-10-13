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

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useId, useState } from 'react'
import { color, space } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { Button } from '../atoms/Button'
import { Slab } from '../atoms/Slab'

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
  /**
   * Can the reader fold this section away at all? Defaults to true.
   *
   * The sheet's OPENING sections (Identity / Chassis, Vitals) pass false: they
   * are the sheet's subject and its live state, always wanted, and collapsing
   * them would leave a page of labels above the content. A fold is for the
   * collections below them, which a reader closes to get past.
   */
  collapsible?: boolean
  /** DOM id on the section — an in-page link target (e.g. the header's
   *  "Assigned Units" jump). */
  id?: string
  children: ReactNode
}

/** `compact`'s 28px, the one documented override on the `iconOnly` rung: this
 *  chevron shares the slab's actions rail with the section Edit/Add buttons,
 *  which run at `compact`, so it matches THEM rather than the rung's 36px. */
const FOLD_BUTTON = {
  width: space[28],
  height: space[28],
  borderColor: color.ink35,
} satisfies CSSProperties

const CHEVRON = {
  width: space[16],
  height: space[16],
  transitionProperty: 'transform, translate, scale, rotate',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  transitionDuration: '150ms',
} satisfies CSSProperties

const BODY = { minWidth: 0 } satisfies CSSProperties

/** Slab-led, unframed section container for entity-card collections. */
export function SheetSectionSlab({
  title,
  count,
  controls,
  className,
  bodyClassName,
  collapsible = true,
  id,
  children,
}: SheetSectionSlabProps) {
  // Slabs always start OPEN — a sheet whose sections were all shut would open
  // on a page of labels telling you nothing about the character. (Entity CARDS
  // default the other way; see `ReferenceEntityCard.collapsible`.)
  const [collapsed, setCollapsed] = useState(false)
  const bodyId = useId()
  const folded = collapsible && collapsed

  return (
    // `.sheet-section` keeps the print page-break rule the card container also
    // carries, so moving a section between the two never changes pagination.
    <section id={id} className={cn('sheet-section', className)}>
      {/* Wrapping (`.su-sheet-slab-lead`): the slab leader is one flex row of shrink-0 parts (stamp,
          count, rule, controls). A long title beside a long control — e.g.
          "Armament Bay Weapons" + "+ Add weapons system" — is 432px of content
          in a 350px column at 390px viewport, which overflowed the sheet
          sideways (measured, not assumed). Wrapping drops the controls to
          their own line instead; the card container never had this problem
          because its header band is a separate `ml-auto` row. */}
      <Slab
        variant="solid"
        label={title}
        count={count}
        className="su-sheet-slab-lead"
        actions={
          <>
            {controls}
            {collapsible && (
              <Button
                variant="ghost"
                size="iconOnly"
                onClick={() => setCollapsed((v) => !v)}
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                // The accessible name carries the section, so a screen reader
                // hears "Collapse Systems" rather than a rail of bare chevrons.
                aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
                style={FOLD_BUTTON}
              >
                <ChevronDown
                  aria-hidden="true"
                  style={collapsed ? { ...CHEVRON, rotate: '-90deg' } : CHEVRON}
                />
              </Button>
            )}
          </>
        }
      />
      {/* Kept mounted and hidden rather than unmounted: the cards inside hold
          their own open/closed state, and unmounting would silently reset every
          one of them each time the section was folded. */}
      <div id={bodyId} hidden={folded} className={bodyClassName} style={BODY}>
        {children}
      </div>
    </section>
  )
}
