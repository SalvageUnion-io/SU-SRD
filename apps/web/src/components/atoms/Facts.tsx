/**
 * Facts — written fields as a description list, a small caps label over each
 * value (ruleset §3.7, its list form). A field with nothing written is left
 * out (R11). The one list a sheet's written words take: a group's fields, a
 * masthead's traits, a Storage Bay's Scrap board.
 *
 * Prose — a long text kept to a few lines, the rest one press away.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import type { CSSVarStyle } from '../../styles/cssVars'
import { capsLabel } from './capsLabel'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

export type Fact = {
  key: string
  label: ReactNode
  value: ReactNode
  /** Takes the list's whole width (a paragraph). */
  wide?: boolean
  /** Nothing in it yet: drawn quiet, never left out (a Scrap count of 0). */
  empty?: boolean
  /** Its own paint (`--tl`, a Tech Level's swatch). */
  style?: CSSProperties | CSSVarStyle
}

type FactsProps = {
  facts: readonly (Fact | false | null | undefined)[]
  /** The list's class: `su-dash-facts` (a group's fields) unless it is another list. */
  className?: string
  /** Each field's class: `su-dash-fact` unless the list names its own. */
  itemClassName?: string
  /** Laid over each label's caps (`su-mast-id__label`). */
  labelClassName?: string
  /** Names the list for assistive tech: "Scrap by Tech Level". */
  label?: string
}

export function Facts({
  facts,
  className = 'su-dash-facts',
  itemClassName = 'su-dash-fact',
  labelClassName,
  label,
}: FactsProps) {
  const shown = facts.filter(
    (fact): fact is Fact =>
      !!fact && fact.value !== '' && fact.value !== null && fact.value !== undefined
  )
  if (shown.length === 0) return null
  return (
    <dl className={className} aria-label={label}>
      {shown.map((fact) => (
        <div
          key={fact.key}
          className={cn(itemClassName, fact.wide && 'su-dash-fact--wide')}
          data-empty={fact.empty ? '' : undefined}
          style={fact.style as CSSProperties | undefined}
        >
          <dt className={cn(labelClassName, CAPS)}>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A long text at a few lines, the rest one press away. */
export function Prose({
  text,
  lines = 4,
  children,
}: {
  /** The text, a paragraph a blank line. */
  text?: string | undefined
  lines?: number
  /** In place of `text`: prose already set (`TraitProse`). */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  // Only a text that overflows its lines offers "More".
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measured when the text or the fold changes
  useEffect(() => {
    const node = ref.current
    if (!node || open) return
    setClipped(node.scrollHeight > node.clientHeight + 1)
  }, [text, open, lines])
  const paragraphs = (text ?? '').split(/\n\s*\n/).filter((part) => part.trim() !== '')
  if (!children && paragraphs.length === 0) return null
  return (
    <>
      <div
        ref={ref}
        className="su-dash-prose"
        data-clamp={open ? undefined : ''}
        style={{ '--lines': lines } as CSSVarStyle}
      >
        {children ?? paragraphs.map((part) => <p key={part}>{part}</p>)}
      </div>
      {(clipped || open) && (
        <button
          type="button"
          className={cn('su-dash-more', CAPS)}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {atomsCopy(open ? 'less' : 'more')}
        </button>
      )}
    </>
  )
}
