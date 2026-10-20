/**
 * SlabSection — the one section (ruleset §6.4): a `Slab`, one gap, its body.
 * Every section a Slab heads is this, on a sheet, a Manage page, a wizard, a
 * Page or Play's columns; hard rule R1's `chrome/slab-section` fails a Slab
 * set straight into a hand-built `<section>`.
 *
 * - **One gap**, head to body: 8px, the inside-a-block rung of §4.4. On a
 *   Page (`page`) the Slab and its body are level-1 blocks, so they sit
 *   R17's 12px apart. The Slab's own foot margin is off (`flush`); the gap
 *   is this column's.
 * - **One fold** (`fold`): the Compact `iconOnly` ghost Button at the rule's
 *   end, a `ChevronDown` that turns a quarter when shut, named "Collapse
 *   <title>" / "Expand <title>". The body is hidden, never unmounted, so
 *   what is inside keeps its own state.
 * - **A count** is the Slab's: a hint at the rule's end, or a `SlabCount`
 *   drawn as its label-first chip (`SEATS | 5/6`).
 * - `id` is the heading's: the section is `aria-labelledby` it, a named
 *   region. With no `id` the section is unnamed, a plain grouping.
 * - `.su-sheet-section` is the print stylesheet's page-break target
 *   (`styles/build/print.css`), on every section.
 * - The head wraps (`.su-slab-section__head`): a long title beside long
 *   actions drops the actions to their own line rather than overflowing a
 *   phone's column.
 * - On a live sheet a section of entities is this, unframed: the cards carry
 *   their own frames, so a second would stack two enclosures into one block.
 *   A section of fields and gauges is a `SheetSectionCard`, a form's panel.
 * - The column is a class (`.su-slab-section`, `containers.css`), so a page
 *   whose layout law sets a section's own grid (the class page's trees, a
 *   subgrid) can say so in its stylesheet.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Children } from 'react'
import { color, duration, ease, iconSize } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { useDisclosure } from '../../lib/useDisclosure'
import { Button } from '../atoms/Button'
import type { SlabCount } from '../atoms/Slab'
import { Slab } from '../atoms/Slab'

type SlabSectionProps = {
  /** The section's name: the Slab's solid stamp. */
  title: ReactNode
  /** The heading's DOM id; the section is `aria-labelledby` it. */
  id?: string
  /** The title's element (`h2`, `h3`); a `span` by default, as the Slab's. */
  as?: ElementType
  /** A hint at the rule's end, or a value count as its chip (`SEATS | 5/6`). */
  count?: ReactNode | SlabCount | readonly SlabCount[]
  /** The count beside the stamp (the Training Bay's Shelves) rather than at the rule's end. */
  countAt?: 'end' | 'label'
  /** The count in the ground's own ink, for a section on a tinted ground. */
  countInk?: 'muted' | 'inherit'
  /** Controls after the rule (the section's "+ Add", Manage). */
  actions?: ReactNode
  /** A fold control at the rule's end, and the state the section starts in. */
  fold?: 'open' | 'closed'
  /** The fold's name when the title is not plain text. */
  foldLabel?: string
  /** On a Page: head and body are level-1 blocks, 12px apart (R17). */
  page?: boolean
  /** The section's name when it has no `id` to be labelled by. */
  'aria-label'?: string
  className?: string
  /** The section's own box in its parent's layout (a grid span, a width). */
  style?: CSSProperties
  /** The body's layout: its own gap between what it holds. */
  bodyClassName?: string
  bodyStyle?: CSSProperties
  children?: ReactNode
}

/** The fold's square: Compact, as the Manage buttons it shares the rail with (§4.7). */
const FOLD_BUTTON = { borderColor: color.ink35 } satisfies CSSProperties

const CHEVRON = {
  transitionProperty: 'transform, translate, scale, rotate',
  transitionTimingFunction: ease,
  transitionDuration: duration.base,
} satisfies CSSProperties

const CHEVRON_SHUT = { ...CHEVRON, rotate: '-90deg' } satisfies CSSProperties

export function SlabSection({
  title,
  id,
  as,
  count,
  countAt,
  countInk,
  actions,
  fold,
  foldLabel,
  page = false,
  'aria-label': ariaLabel,
  className,
  style,
  bodyClassName,
  bodyStyle,
  children,
}: SlabSectionProps) {
  const disclosure = useDisclosure(fold !== 'closed')
  const open = fold === undefined || disclosure.open
  const name = foldLabel ?? (typeof title === 'string' ? title : '')
  // An empty body (a list with nothing in it) is left out, gap and all; a
  // folding section keeps its panel for the fold to name.
  const hasBody = fold !== undefined || Children.toArray(children).length > 0
  const foldControl = fold && (
    <Button
      variant="ghost"
      size="iconOnly"
      {...disclosure.toggleProps}
      aria-label={`${disclosure.open ? 'Collapse' : 'Expand'} ${name}`.trim()}
      style={FOLD_BUTTON}
    >
      <ChevronDown
        aria-hidden="true"
        size={iconSize.compact}
        style={disclosure.open ? CHEVRON : CHEVRON_SHUT}
      />
    </Button>
  )
  return (
    <section
      aria-labelledby={id}
      aria-label={id ? undefined : ariaLabel}
      className={cn(
        'su-slab-section',
        page && 'su-slab-section--page',
        'su-sheet-section',
        className
      )}
      style={style}
    >
      <Slab
        as={as}
        id={id}
        label={title}
        count={count}
        countAt={countAt}
        countInk={countInk}
        flush
        className={cn(
          'su-slab-section__head',
          fold && 'su-slab-section__head--fold',
          (actions || fold) && 'su-slab-section__head--controls'
        )}
        actions={
          actions || foldControl ? (
            <>
              {actions}
              {foldControl}
            </>
          ) : undefined
        }
      />
      {hasBody && (
        <div
          id={fold ? disclosure.panelId : undefined}
          hidden={!open}
          className={cn('su-slab-section__body', bodyClassName)}
          style={bodyStyle}
        >
          {children}
        </div>
      )}
    </section>
  )
}
