/**
 * The Cantina's detail dialog IS the Page (EDL Form 5, E5): the chapter band with the
 * title notched in and the chips clustered beside it (E20), the card at
 * `presentation="page"` as its body (a chassis's stats leading it, the art its
 * hero), and the foot's citation in the card footer's plain text. Never a
 * framed card. Both openers draw it: `useDetailModal` and a
 * depth-2 Row. A pattern's Page links its chassis (`PATTERN OF | Mule`)
 * through the surface's Page opener, as the SRD's pattern page does.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { EntityRef, RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../entity/EntitySurface'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { EntityExternalLinkProvider } from '../entityHrefContext'
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
    // Every chip the entity carries rides the band, its Tech Level among them.
    const stamps = band.querySelector<HTMLElement>('.su-entity-stamps')
    if (!stamps) throw new Error('no band stamps')
    expect(within(stamps).getByText('Tech Level')).toBeTruthy()
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
    const page = dialog.querySelector<HTMLElement>('.su-entity-page')
    if (!page) throw new Error('no page')
    const side = page.querySelector<HTMLElement>('.su-entity-page__side')
    expect(side?.firstElementChild?.classList.contains('su-entity-page__stats')).toBe(true)
    // With art the page flows round it from 64rem (`.su-entity-page--flow`).
    expect(page.classList.contains('su-entity-page--flow')).toBe(true)
    expect(page.querySelector('.su-entity-page__art')).toBeTruthy()
    // A chassis's stats are its body's, not the band's (E20).
    const stamps = dialog.querySelector<HTMLElement>('.su-entity-stamps')
    expect(stamps?.querySelector('.su-stat-column__cell')).toBeNull()
  })

  test("its foot cites the book in the card footer's plain text, the kind beside it", () => {
    const dialog = openPage(redLaser())
    const article = dialog.querySelector('article')
    const foot = article?.lastElementChild as HTMLElement | null
    if (!foot) throw new Error('no foot')
    expect(foot.textContent).toMatch(/· p\.\d+/)
    expect(foot.textContent).toContain('System')
    // Plain text, not citation chips.
    expect(foot.querySelector('.su-stat-plate')).toBeNull()
  })

  test('the foot carries the app\'s cross-link ("View in SRD")', () => {
    render(
      <EntityExternalLinkProvider value={() => <a href="/srd/red-laser">View in SRD</a>}>
        <Harness data={redLaser()} />
      </EntityExternalLinkProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'View in SRD' })
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
    // It leads the cluster, as on the SRD's pattern page.
    expect(stamps.firstElementChild?.contains(chip)).toBe(true)
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

  test('a depth-2 Row opens the same Page', () => {
    render(<ReferenceEntityCard data={sestra()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Hover Locomotion System' }))
    const dialog = screen.getByRole('dialog', { name: /^Hover Locomotion System/ })
    expect(dialog.querySelector('.su-chapter-band')).toBeTruthy()
    expect(dialog.querySelector('.su-entity-dialog__body > .su-entity-page')).toBeTruthy()
  })
})
