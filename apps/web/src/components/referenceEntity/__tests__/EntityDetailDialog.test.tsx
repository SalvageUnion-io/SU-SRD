/**
 * The app's detail dialog IS the Page (EDL Form 5, E5): the chapter band with the
 * title notched in and the chips clustered beside it (E20), the card at
 * `presentation="page"` as its body (its stats leading it as the stat column,
 * the art its hero), and the foot's citation in the card footer's plain text. Never a
 * framed card. Both openers draw it: `useDetailModal` and a
 * level-2 Mini (N1). A pattern's Page links its chassis (`PATTERN OF | Mule`)
 * through the surface's Page opener, as the SRD's pattern page does.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { EntityRef, RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../entity/EntitySurface'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { useDetailModal } from '../useDetailModal'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const redLaser = () =>
  need(SalvageUnionReference.Systems.getByName('Red Laser'), 'red laser') as RefEntity
const mule = () => need(SalvageUnionReference.Chassis.getByName('Mule'), 'mule') as RefEntity
const sestra = () => need(SalvageUnionReference.Chassis.getByName('Little Sestra'), 'sestra')

function Harness({ data, pattern }: { data: RefEntity; pattern?: RefObjectAnyPattern }) {
  const { control, modal } = useDetailModal(data, { forceModal: true, pattern })
  return (
    <>
      <button type="button" onClick={control.onClick}>
        open
      </button>
      {modal}
    </>
  )
}

function openPage(data: RefEntity, pattern?: RefObjectAnyPattern): HTMLElement {
  render(<Harness data={data} pattern={pattern} />)
  fireEvent.click(screen.getByRole('button', { name: 'open' }))
  return screen.getByRole('dialog')
}

describe('the detail dialog is the Page', () => {
  test('its head is the chapter band: the title notched in, the chips beside it', () => {
    const dialog = openPage(redLaser())
    const band = dialog.querySelector<HTMLElement>('.su-chapter-band')
    if (!band) throw new Error('no chapter band')
    // E20: the chips cluster beside the title, under it on a phone.
    expect(band.dataset.aside).toBe('notch')
    const title = within(band).getByRole('heading', { name: 'Red Laser (System)' })
    expect(title.classList.contains('su-chapter-band__title')).toBe(true)
    // The band wears the entity's tone (a gear's tech level), as its card's head does.
    expect(band.style.backgroundColor).toContain('--color-tl-')
    // The entity's chips ride the band; its stats, Tech Level first, lead
    // the body as the stat column.
    const stamps = band.querySelector<HTMLElement>('.su-entity-stamps')
    if (!stamps) throw new Error('no band stamps')
    expect(within(stamps).getByText('Turn Action')).toBeTruthy()
    expect(within(stamps).queryByText('Tech Level')).toBeNull()
    const stats = dialog.querySelector<HTMLElement>('.su-manual__stats')
    if (!stats) throw new Error('no stat column')
    expect(stats.querySelector('.su-stat-label--long')?.textContent).toBe('Tech Level')
  })

  test('its body is the card at presentation="page", not the framed card', () => {
    const dialog = openPage(redLaser())
    const body = dialog.querySelector<HTMLElement>('.su-entity-dialog__body')
    if (!body) throw new Error('no page body')
    expect(body.firstElementChild?.classList.contains('su-entity-page')).toBe(true)
    // No framed card and no cut-out head: the band is the Page's head.
    expect(body.querySelector('.su-ec-frame')).toBeNull()
  })

  test("a chassis's stats lead its body, and its art is the hero", () => {
    const dialog = openPage(mule())
    const page = dialog.querySelector<HTMLElement>('.su-entity-page.su-manual')
    if (!page) throw new Error('no page')
    // The art heads the side column, which floats beside the rules from 64rem.
    expect(page.querySelector('.su-manual__side > .su-manual__art img')).toBeTruthy()
    // All eight of the book's stats, in its order, in the stat column: none on the band.
    const labels = [...page.querySelectorAll('.su-manual__stats .su-stat-label--long')].map(
      (label) => label.textContent
    )
    expect(labels).toEqual([
      'Tech Level',
      'Salvage Value',
      'Structure Points',
      'Energy Points',
      'System Slots',
      'Module Slots',
      'Heat Capacity',
      'Cargo Capacity',
    ])
    expect(
      dialog.querySelector(
        '.su-chapter-band :is([data-chip-class="rank"], [data-chip-class="measure"])'
      )
    ).toBeNull()
  })

  // Rulings 2026-10-19: no kind on the foot; the foot wears the band, edge to edge.
  test("its foot cites the book in the card footer's plain text, in the band's colour, no kind", () => {
    const dialog = openPage(redLaser())
    const article = dialog.querySelector('article')
    const foot = article?.lastElementChild as HTMLElement | null
    if (!foot) throw new Error('no foot')
    expect(foot.textContent).toMatch(/· p\.\d+/)
    expect(foot.textContent).not.toContain('System')
    // Plain text, not citation chips.
    expect(foot.querySelector('.su-stat-plate')).toBeNull()
    expect(foot.style.background).not.toBe('')
    expect(foot.style.borderTopStyle).toBe('')
    expect(foot.getAttribute('data-grain')).not.toBeNull()
  })

  // Source 2 (Jrvs 2026-11-17): the source is CUT into the foot band, so its
  // cut-out wears the Page's ground, never a paper tab laid on the band.
  test("the source's cut-out wears the Page's ground", () => {
    const dialog = openPage(redLaser())
    const foot = dialog.querySelector('article')?.lastElementChild as HTMLElement | null
    const cutout = within(foot ?? dialog)
      .getByText(/· p\.\d+/)
      .closest<HTMLElement>('[style*="background-color"]')
    expect(cutout?.style.backgroundColor).toBe('var(--su-foot-ground)')
    const page = dialog.querySelector<HTMLElement>('article')
    expect(page?.style.getPropertyValue('--su-foot-ground')).toBe('var(--color-wk-bg)')
  })

  test('the foot carries the app\'s cross-link ("View in the Reference")', () => {
    render(
      <EntitySurfaceProvider
        value={{ externalLink: () => <a href="/srd/red-laser">View in the Reference</a> }}
      >
        <Harness data={redLaser()} />
      </EntitySurfaceProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    const link = within(screen.getByRole('dialog')).getByRole('link', {
      name: 'View in the Reference',
    })
    expect(link.getAttribute('target')).toBeNull()
  })

  test("a pattern's Page is titled with its quoted name", () => {
    const chassis = mule()
    const pattern = need(
      'patterns' in chassis && Array.isArray(chassis.patterns) ? chassis.patterns[0] : undefined,
      'mule pattern'
    ) as RefObjectAnyPattern
    const dialog = openPage(chassis, pattern)
    const heading = within(dialog).getAllByRole('heading')[0]
    expect(heading?.textContent).toContain(`“${pattern.name}”`)
  })

  test("a pattern's Page leads its chips with PATTERN OF, which opens its chassis", () => {
    const chassis = mule()
    const pattern = need(
      'patterns' in chassis && Array.isArray(chassis.patterns) ? chassis.patterns[0] : undefined,
      'mule pattern'
    ) as RefObjectAnyPattern
    const opener = mock((_ref: EntityRef) => {})
    render(
      <EntitySurfaceProvider value={{ openPage: opener }}>
        <Harness data={chassis} pattern={pattern} />
      </EntitySurfaceProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    const stamps = screen.getByRole('dialog').querySelector<HTMLElement>('.su-entity-stamps')
    if (!stamps) throw new Error('no band stamps')
    const chip = within(stamps).getByRole('button', { name: 'Pattern of: Mule' })
    // It is the band's relation chip (C2), as on the SRD's pattern page.
    expect(chip.closest('[data-chip-class]')?.getAttribute('data-chip-class')).toBe('relation')
    fireEvent.click(chip)
    expect(opener).toHaveBeenCalledTimes(1)
    const ref = opener.mock.calls[0]?.[0]
    expect(ref?.schemaName).toBe('chassis')
    expect(ref?.id).toBe(chassis.id)
    // The chassis itself, not the pattern again.
    expect(ref?.pattern).toBeUndefined()
  })

  test("an entity's own Page has no PATTERN OF chip", () => {
    const dialog = openPage(mule())
    expect(within(dialog).queryByText('Pattern of')).toBeNull()
  })

  test('a level-2 Mini opens the same Page', () => {
    render(<ReferenceEntityCard data={sestra()} presentation="page" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Hover Locomotion System' }))
    const dialog = screen.getByRole('dialog', { name: /^Hover Locomotion System/ })
    expect(dialog.querySelector('.su-chapter-band')).toBeTruthy()
    expect(dialog.querySelector('.su-entity-dialog__body > .su-entity-page')).toBeTruthy()
  })
})
