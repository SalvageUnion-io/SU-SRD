/**
 * Dash — The sheet dashboard's layout.
 *
 * `Dash` is the grid under the header strip: three columns from 80rem (what
 * the unit does, what it has, what it carries and who it is), two from 48rem,
 * one below. `DashGroup` is a group in a column: a label on a rule (the
 * `SlabSection`, drawn by the surface's look) over its body. `PinnedVitals` is a
 * phone's vitals, pinned over the stacked groups. A group's written fields
 * are the library's `Facts`, a long text its `Prose`.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { PhoneVitals, PhoneVitalsGlance } from '../../components/app'
import type { PhoneVital, SlabCount } from '../../components/index'
import { capsLabel, cn, SlabSection } from '../../components/index'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

// Watched for the pin's stuck state; it takes back its own 1px.
const SENTINEL = {
  height: '1px',
  marginBottom: '-1px', // design-tokens-ignore(raw-spacing): a fit, the sentinel takes back its own 1px
} satisfies CSSProperties

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
      as="h2"
      title={title}
      count={tally}
      actions={actions}
      bodyClassName="su-dash-group__body"
    >
      {children}
    </SlabSection>
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
  name,
  vitals,
  foot,
}: {
  label: string
  /** The unit's name, on the pinned strip's cut-out once it sticks. */
  name?: string
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
      <div ref={sentinel} aria-hidden="true" style={SENTINEL} />
      <div className="su-dash-pin" data-stuck={stuck ? '' : undefined}>
        {name && (
          <span className={cn('su-dash-pin__name', CAPS, CAPS)} aria-hidden={!stuck}>
            {name}
          </span>
        )}
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
