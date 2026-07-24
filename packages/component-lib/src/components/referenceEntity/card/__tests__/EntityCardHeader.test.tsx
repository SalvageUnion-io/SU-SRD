/**
 * Header width allocation — who yields depends on what occupies the right side.
 *
 * This rule has regressed in three directions: the title running under the stat
 * cluster (fixed by the 60/40 split), the title wrapping beside an EMPTY right
 * side (the unconditional 60% cap reserving 40% for nothing — "Coolant Flush"
 * on two lines), and flavour PROSE reserving its enormous content width and
 * starving the title to one letter per line ("Bionic Arms" stacked vertically).
 * happy-dom performs no real layout, so these tests pin the CLASSES that encode
 * the rule rather than pixel widths:
 * - empty right side  → title `flex-1`, no 60% cap;
 * - stat cluster only → stats reserve (no `flex-1` column in full), title yields;
 * - flavour prose     → BOTH sides `flex-auto`, so each is sized from its own
 *   max-content and the overflow is split in proportion to how much text each
 *   side has (title keeps the 60% ceiling). Neither side may reserve a FIXED
 *   share: a fixed 60/40 gave the title 60% whether it needed it or not,
 *   leaving a short title beside a description crushed into twice the lines.
 *   Proportional sizing is also what now prevents the one-letter-per-line
 *   starvation — the title can't drop below its share of the row — where the
 *   old rule needed the cap to do it, because prose reserved content width
 *   against the title's zero basis and so took none of the shrink.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityCardHeader } from '../EntityCardHeader'
import type { StatItem } from '../../../shared/statsBarTypes'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(cleanup)

// Real game content, per the story/test data rule. "Coolant Flush" is the
// module from the wrapped-title bug report; the prose is a real ability
// description (arbitrary-length flavour, the one-letter-per-line trigger).
const TITLE = 'Coolant Flush'
const prose = () => {
  const ability = SalvageUnionReference.Abilities.all().find(
    (a) => typeof a.description === 'string' && a.description.length > 80
  )
  if (!ability) throw new Error('no long-description ability in fixtures')
  return String(ability.description)
}
const stats = (): StatItem[] => [
  { key: 'tech-level', label: 'Tech', bottomLabel: 'Level', value: '1' },
  { key: 'salvageValue', label: 'Salvage', bottomLabel: 'Value', value: '1' },
]

const titleWrapper = () => {
  const el = screen.getByText(TITLE).parentElement
  if (!el) throw new Error('title has no wrapper')
  return el
}
// The right-side column is the title wrapper's only sibling.
const rightColumn = () => titleWrapper().nextElementSibling

describe.each([false, true])('EntityCardHeader width allocation (compact=%p)', (compact) => {
  const base = {
    title: TITLE,
    bg: 'bg-tl-1',
    bgColor: undefined,
    titleClass: 'text-5xl',
    compact,
  }

  test('title alone owns the full row — no 60% cap reserved for nothing', () => {
    render(<EntityCardHeader {...base} stats={[]} />)

    expect(titleWrapper().className).toContain('flex-1')
    expect(titleWrapper().className).not.toContain('max-w-[60%]')
    expect(rightColumn()).toBeNull()
  })

  test('with flavour prose both sides flex from their own content width', () => {
    render(
      <EntityCardHeader
        {...base}
        stats={[]}
        rightContent={<span className="min-w-0 flex-1 text-right font-body italic">{prose()}</span>}
      />
    )

    // Neither side reserves a fixed share: `flex-auto` on both makes the flex
    // base each side's max-content, so the overflow is absorbed in proportion
    // to the amount of text. `flex-1` (basis 0) on either side would restore
    // the fixed 60/40 split this replaced.
    expect(titleWrapper().className).toContain('flex-auto')
    expect(rightColumn()?.className).toContain('flex-auto')
    expect(titleWrapper().className).not.toContain('flex-1')
    expect(rightColumn()?.className).not.toContain('flex-1')
    // The ceiling stays, so a long title beside a one-word description can
    // still claim no more than 60% of the row.
    expect(titleWrapper().className).toContain('max-w-[60%]')
  })
})

describe('EntityCardHeader with a stat cluster (the overlap fix, kept)', () => {
  test('full: stats reserve their content width; the title is the yielding side', () => {
    render(
      <EntityCardHeader
        title={TITLE}
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-5xl"
        stats={stats()}
      />
    )

    expect(titleWrapper().className).toContain('flex-1')
    // No flex-1 on the cluster: it holds content size so the title wraps
    // beside it instead of running under it.
    expect(rightColumn()?.className).not.toContain('flex-1')
  })

  test('compact: the row still splits 60/40 — title capped, cluster takes the rest', () => {
    render(
      <EntityCardHeader
        title={TITLE}
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-xl"
        stats={stats()}
        compact
      />
    )

    expect(titleWrapper().className).toContain('max-w-[60%]')
    expect(rightColumn()?.className).toContain('flex-1')
  })

  test('full, stats AND prose: the prose flips both sides to proportional', () => {
    render(
      <EntityCardHeader
        title={TITLE}
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-5xl"
        stats={stats()}
        rightContent={<span className="min-w-0 flex-1 text-right font-body italic">{prose()}</span>}
      />
    )

    expect(titleWrapper().className).toContain('max-w-[60%]')
    expect(titleWrapper().className).toContain('flex-auto')
    expect(rightColumn()?.className).toContain('flex-auto')
  })
})
