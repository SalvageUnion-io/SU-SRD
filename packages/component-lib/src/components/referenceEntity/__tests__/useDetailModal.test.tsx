/**
 * `useDetailModal` is the one place that decides what "View details" DOES: open
 * the in-place `EntityDetailDialog`, or navigate to the entity's show page in a
 * new tab. Two apps depend on opposite answers — srd sets link mode (its
 * entities have real URLs), ITUN leaves it off (its href would deep-link out of
 * the app) — and `forceModal` overrides link mode for views with no standalone
 * URL (chassis patterns). Nothing about that routing is visible to typecheck,
 * so it is pinned here alongside the dialog chrome it mounts.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityDetailLinkProvider, EntityHrefProvider } from '../entityHrefContext'
import { PatternEquipmentItem } from '../pattern/PatternEquipmentItem'
import { useDetailModal } from '../useDetailModal'

const system = (name: string): SURefEntity => {
  const match = SalvageUnionReference.Systems.all().find((s) => s.name === name)
  if (!match) throw new Error(`fixture missing: system ${name}`)
  return match as SURefEntity
}

/** Minimal consumer: a plain trigger wired to the hook's control, plus the
 *  modal node the hook hands back. Keeps the assertions about the hook rather
 *  than about whichever card happens to host the control. */
function Harness({ data, forceModal }: { data: SURefEntity | undefined; forceModal?: boolean }) {
  const { control, modal } = useDetailModal(data, { forceModal })
  return (
    <>
      <button type="button" onClick={control.onClick} aria-label={control.ariaLabel}>
        trigger
      </button>
      {modal}
    </>
  )
}

/** Captured before any test can swap it. Link-mode tests stub `window.open` to
 *  observe the navigation; restoring in an `afterEach` rather than at the end of
 *  each test body means a failing assertion cannot leak the stub into every
 *  later test in the process. */
const REAL_WINDOW_OPEN = window.open
afterEach(() => {
  window.open = REAL_WINDOW_OPEN
})

describe('useDetailModal — modal mode (no link provider)', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('the dialog stays closed until the control is clicked', () => {
    render(<Harness data={system('Red Laser')} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test("the open dialog renders the entity's card and an accessible name", () => {
    render(<Harness data={system('Red Laser')} />)
    fireEvent.click(screen.getByLabelText('View details'))
    // The screen-reader-only Dialog.Title carries the entity name; the visible
    // title comes from the card inside it — hence two matches, not one.
    expect(screen.getAllByText('Red Laser').length).toBeGreaterThan(1)
    expect(screen.getByText('Entity display details')).toBeTruthy()
  })

  test('the dialog closes again via its close button', () => {
    render(<Harness data={system('Red Laser')} />)
    fireEvent.click(screen.getByLabelText('View details'))
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('no entity means no modal node at all', () => {
    render(<Harness data={undefined} />)
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('an entity with no schemaName gets no modal — the card could not route it', () => {
    render(<Harness data={{ name: 'Orphan' } as unknown as SURefEntity} />)
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('useDetailModal — link mode (srd)', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  const renderLinked = (opts: { forceModal?: boolean; noHref?: boolean } = {}) => {
    const opened: Array<[string?, string?, string?]> = []
    // biome-ignore lint/suspicious/noExplicitAny: test double for window.open
    ;(window as any).open = (...args: [string?, string?, string?]) => {
      opened.push(args)
      return null
    }
    const result = render(
      <EntityHrefProvider
        value={() => (opts.noHref ? undefined : '/schema/systems/item/red-laser')}
      >
        <EntityDetailLinkProvider value={true}>
          <Harness data={system('Red Laser')} forceModal={opts.forceModal} />
        </EntityDetailLinkProvider>
      </EntityHrefProvider>
    )
    return { opened, ...result }
  }

  test('clicking navigates to the show page in a new tab instead of opening a dialog', () => {
    const { opened } = renderLinked()
    fireEvent.click(screen.getByLabelText('View details'))
    expect(opened).toEqual([['/schema/systems/item/red-laser', '_blank', 'noopener,noreferrer']])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('forceModal beats link mode — pattern views have no URL to link to', () => {
    const { opened } = renderLinked({ forceModal: true })
    fireEvent.click(screen.getByLabelText('View details'))
    expect(opened).toEqual([])
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('link mode with no resolvable href falls back to the modal', () => {
    const { opened } = renderLinked({ noHref: true })
    fireEvent.click(screen.getByLabelText('View details'))
    expect(opened).toEqual([])
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('PatternEquipmentItem — the hook wired into a real card', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('exposes a visible detail control on the head listing that opens the card', () => {
    render(<PatternEquipmentItem data={system('Red Laser')} />)
    // The listing itself shows the name once; the modal is not mounted yet.
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
