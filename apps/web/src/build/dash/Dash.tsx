/**
 * Dash — MOCK (density mock, sheet variant): the sheet dashboard's layout.
 *
 * `Dash` is the grid under the header strip: three columns from 80rem (what
 * the unit does, what it has, what it carries and who it is), two from 48rem,
 * one below. `DashGroup` is a group in a column: a label on a rule (the
 * `SlabSection`, drawn by the surface's look) over its body. `Facts` is a
 * group's written fields, a small label over each; `Prose` a long text that
 * keeps to a few lines until it is asked for; `PinnedVitals` a phone's
 * vitals, pinned over the stacked groups.
 */

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { CSSVarStyle, PhoneVital, SlabCount } from '../../components/index'
import { cn, PhoneVitals, PhoneVitalsGlance, SlabSection } from '../../components/index'

export function Dash({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className="su-dash" data-cols={cols}>
      {children}
    </div>
  )
}

export function DashColumn({
  children,
  wide = false,
  label,
}: {
  children: ReactNode
  /** Takes two of the three columns (a crawler's bays). */
  wide?: boolean
  /** Names the column for assistive tech: "What Mazona does". */
  label?: string
}) {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: a labelled group, not a landmark
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn('su-dash__col', wide && 'su-dash__col--wide')}
    >
      {children}
    </div>
  )
}

export function DashGroup({
  title,
  tally,
  actions,
  children,
}: {
  title: ReactNode
  tally?: ReactNode | SlabCount | readonly SlabCount[]
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <SlabSection
      as="h3"
      title={title}
      count={tally}
      actions={actions}
      bodyClassName="su-dash-group__body"
    >
      {children}
    </SlabSection>
  )
}

export type Fact = {
  key: string
  label: ReactNode
  value: ReactNode
  /** Takes the list's whole width (a paragraph). */
  wide?: boolean
}

/** A group's written fields; a field with nothing written is left out (R11). */
export function Facts({ facts }: { facts: readonly (Fact | false | null | undefined)[] }) {
  const shown = facts.filter(
    (fact): fact is Fact =>
      !!fact && fact.value !== '' && fact.value !== null && fact.value !== undefined
  )
  if (shown.length === 0) return null
  return (
    <dl className="su-dash-facts">
      {shown.map((fact) => (
        <div key={fact.key} className={cn('su-dash-fact', fact.wide && 'su-dash-fact--wide')}>
          <dt>{fact.label}</dt>
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
          className="su-dash-more"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Less' : 'More'}
        </button>
      )}
    </>
  )
}

/**
 * A phone's vitals, pinned over the stacked groups: Play's pinned card
 * (`PhoneVitalsGlance`, play.md §11), each cell opening the block's rows
 * (`PhoneVitals`, − | + at 44px) under it, so the numbers take one line of the
 * screen until one has to change.
 */
export function PinnedVitals({
  label,
  vitals,
  foot,
}: {
  label: string
  vitals: readonly PhoneVital[]
  foot?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const sentinel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry?.isIntersecting), {
      threshold: 0,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const gauges = vitals.filter((vital) => vital.max !== undefined)
  const live = vitals.some((vital) => vital.onChange)
  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ height: 1, marginBottom: -1 }} />
      <div className="su-dash-pin" data-stuck={stuck ? '' : undefined}>
        <PhoneVitalsGlance
          cells={gauges.map((vital) => ({
            key: vital.key,
            label: vital.label,
            name: vital.name,
            value: vital.value,
            max: vital.max ?? 0,
            hot: vital.danger !== undefined && vital.value > vital.danger,
            open,
            ...(live || vitals.length > gauges.length ? { onPress: () => setOpen(!open) } : {}),
          }))}
        />
        {open && <PhoneVitals label={label} vitals={vitals} foot={foot} />}
      </div>
    </>
  )
}
