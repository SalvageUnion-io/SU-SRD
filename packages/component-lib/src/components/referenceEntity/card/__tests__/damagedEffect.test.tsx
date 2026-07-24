/**
 * A crawler bay's "When Damaged" text has two jobs, and the card tells them
 * apart by whether it was given a `status`.
 *
 * A REFERENCE card (the SRD bay page) has no condition: the effect is part of
 * the entity's rules, so it renders inline in the body, always.
 *
 * A LIVE card (the crawler sheet, which tracks Intact/Damaged) has one: the
 * effect is a STATE. Inline-and-always was wrong in both directions there — an
 * intact bay showed a standing "When Damaged" panel as the only thing in its
 * body, and a bay that actually broke announced it no more loudly than one that
 * had not. So on a live card it is silent while intact and a centred overlay
 * once damaged.
 *
 * These tests pin all three cases; the overlay's `pointer-events-none` is pinned
 * too, because without it the overlay would swallow the very controls that
 * repair the bay.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const commandBay = () => {
  const found = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Command Bay')
  if (!found) throw new Error('Command Bay fixture missing')
  return found
}

afterEach(cleanup)

describe('crawler bay "When Damaged" — reference vs live', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('REFERENCE (no status): renders inline, in the body flow', () => {
    const { container } = render(<ReferenceEntityCard data={commandBay()} size="medium" />)
    expect(screen.getByText('When Damaged')).toBeTruthy()
    // Inline means NOT in an absolutely-positioned overlay.
    const overlay = container.querySelector('div.absolute.z-20')
    expect(overlay).toBeNull()
  })

  test('LIVE + intact: silent — no callout at all', () => {
    render(<ReferenceEntityCard data={commandBay()} size="medium" status="intact" />)
    expect(screen.queryByText('When Damaged')).toBeNull()
  })

  test('LIVE + damaged: a centred overlay that does not eat the card controls', () => {
    const { container } = render(
      <ReferenceEntityCard data={commandBay()} size="medium" status="damaged" />
    )
    expect(screen.getByText('When Damaged')).toBeTruthy()
    const overlay = container.querySelector('div.absolute.z-20')
    if (!(overlay instanceof HTMLElement)) throw new Error('expected the damaged overlay')
    expect(overlay.className).toContain('inset-0')
    expect(overlay.className).toContain('items-center')
    expect(overlay.className).toContain('justify-center')
    // Load-bearing: the status badge and Repair button live UNDER this.
    expect(overlay.className).toContain('pointer-events-none')
  })

  test('LIVE + damaged: renders the effect ONCE (overlay, not overlay + inline)', () => {
    render(<ReferenceEntityCard data={commandBay()} size="medium" status="damaged" />)
    expect(screen.getAllByText('When Damaged')).toHaveLength(1)
  })

  test('hide.damagedEffect still suppresses it in every mode', () => {
    render(
      <ReferenceEntityCard
        data={commandBay()}
        size="medium"
        status="damaged"
        hide={{ damagedEffect: true }}
      />
    )
    expect(screen.queryByText('When Damaged')).toBeNull()
  })
})
