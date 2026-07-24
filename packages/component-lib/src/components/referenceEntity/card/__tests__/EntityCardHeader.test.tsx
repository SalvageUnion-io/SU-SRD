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
 * - flavour prose     → the description ASKS for 55% (`flex-[1_1_55%]`) and the
 *   title yields only once it must (`shrink-[20]`), so a name that fits beside
 *   that ask keeps its single line and a longer one wraps toward its longest
 *   word instead of holding a 60% share it isn't filling.
 *
 * Two clauses of the prose rule were each learned by breaking them, and are
 * asserted here because happy-dom performs no layout and so cannot catch them:
 * the title carries NO `min-w-0` (min-width:auto floors it at min-content —
 * with `min-w-0` the description's share squeezes it until `break-words` splits
 * a name mid-word, "ENGINEERIN / G EXPERTISE"), and the description's share is
 * a flex BASIS, not a `min-width` (a hard floor cannot yield to that
 * min-content floor, and the two together overflow the card on narrow screens).
 *
 * These pin CLASSES rather than pixels. The layout itself is verified by
 * measuring real pages in a browser — see the PR for the numbers.
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

  test('with flavour prose the description asks for 55% and the title yields', () => {
    render(
      <EntityCardHeader
        {...base}
        stats={[]}
        rightContent={<span className="min-w-0 flex-1 text-right font-body italic">{prose()}</span>}
      />
    )

    // The description's share is a flex BASIS. `flex-1` (basis 0) here would
    // restore the fixed 60/40 split, where a wrapping title held 60% of the
    // band and crushed the description into twice the lines.
    expect(rightColumn()?.className).toContain('flex-[1_1_55%]')
    // The title is the yielding side, but only past the point where it fits:
    // its base is its own content width, and `shrink-[20]` makes it absorb
    // essentially all of the overflow instead of sharing it.
    expect(titleWrapper().className).toContain('shrink-[20]')
    expect(titleWrapper().className).not.toContain('flex-1')
    // FLOOR: no `min-w-0`, so min-width:auto holds the title at min-content —
    // its longest word. Drop this and `break-words` splits names mid-word
    // ("ENGINEERIN / G EXPERTISE"), which is what the first cut shipped.
    expect(titleWrapper().className).not.toContain('min-w-0')
    // CEILING: deliberately loose. `max-width` also clamps that min-content
    // floor, so the old 60% cap re-introduced mid-word breaks on narrow cards.
    expect(titleWrapper().className).toContain('max-w-[75%]')
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

  test('full, stats AND prose: the prose rule wins over the stat rule', () => {
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

    expect(titleWrapper().className).toContain('shrink-[20]')
    expect(titleWrapper().className).toContain('max-w-[75%]')
    expect(rightColumn()?.className).toContain('flex-[1_1_55%]')
  })
})
