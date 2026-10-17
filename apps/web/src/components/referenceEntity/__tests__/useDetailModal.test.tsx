/**
 * `useDetailModal` is the one place that decides what "View details" DOES: open
 * the in-place `EntityDetailDialog`, or navigate to the entity's show page in
 * this tab (EDL E5: never a new-tab `window.open`). Two apps depend on opposite answers — srd sets link mode (its
 * entities have real URLs), the Cantina leaves it off (its href would deep-link out of
 * the app) — and `forceModal` overrides link mode for views with no standalone
 * URL (chassis patterns). Nothing about that routing is visible to typecheck,
 * so it is pinned here alongside the dialog chrome it mounts.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { entityFixture } from 'salvageunion-reference/testing'
import { EntityDetailLinkProvider, EntityHrefProvider } from '../entityHrefContext'
import { useDetailModal } from '../useDetailModal'

const system = (name: string): RefEntity => {
  const match = SalvageUnionReference.Systems.getByName(name)
  if (!match) throw new Error(`fixture missing: system ${name}`)
  return match as RefEntity
}

/** Minimal consumer: a plain trigger wired to the hook's control, plus the
 *  modal node the hook hands back. Keeps the assertions about the hook rather
 *  than about whichever card happens to host the control. */
function Harness({ data, forceModal }: { data: RefEntity | undefined; forceModal?: boolean }) {
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

/** Captured before any test can swap it. Link-mode tests stub
 *  `location.assign` to observe the navigation; restoring in an `afterEach`
 *  rather than at the end of each test body means a failing assertion cannot
 *  leak the stub into every later test in the process. */
const REAL_ASSIGN = window.location.assign
afterEach(() => {
  window.location.assign = REAL_ASSIGN
})

describe('useDetailModal — modal mode (no link provider)', () => {
  test('the dialog stays closed until the control is clicked', () => {
    render(<Harness data={system('Red Laser')} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test("the open dialog is the entity's Page, named by the title notched in its band", () => {
    render(<Harness data={system('Red Laser')} />)
    fireEvent.click(screen.getByLabelText('View details'))
    // The band's title is the Dialog.Title: it names the dialog, kind and all.
    const dialog = screen.getByRole('dialog', { name: 'Red Laser (System)' })
    expect(within(dialog).getByRole('heading', { name: 'Red Laser (System)' })).toBeTruthy()
    expect(screen.getByText('Entity display details')).toBeTruthy()
  })

  test('the dialog closes again via its close button', () => {
    render(<Harness data={system('Red Laser')} />)
    fireEvent.click(screen.getByLabelText('View details'))
    // "Close" is also the laser's range (`[RNG | Close]`): the button's name is the one.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('no entity means no modal node at all', () => {
    render(<Harness data={undefined} />)
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('an entity with no schemaName gets no modal — the card could not route it', () => {
    render(<Harness data={entityFixture('chassis', { name: 'Orphan' })} />)
    fireEvent.click(screen.getByLabelText('View details'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('useDetailModal — link mode (srd)', () => {
  const renderLinked = (opts: { forceModal?: boolean; noHref?: boolean } = {}) => {
    const opened: string[] = []
    window.location.assign = (url: string | URL) => {
      opened.push(String(url))
    }
    const result = render(
      <EntityHrefProvider value={() => (opts.noHref ? undefined : '/systems/red-laser')}>
        <EntityDetailLinkProvider value={true}>
          <Harness data={system('Red Laser')} forceModal={opts.forceModal} />
        </EntityDetailLinkProvider>
      </EntityHrefProvider>
    )
    return { opened, ...result }
  }

  test('clicking goes to the show page in this tab instead of opening a dialog', () => {
    const { opened } = renderLinked()
    fireEvent.click(screen.getByLabelText('View details'))
    expect(opened).toEqual(['/systems/red-laser'])
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

describe('DetailIcon — the control glyph', () => {
  function IconHarness({ className }: { className?: string }) {
    const { control } = useDetailModal(system('Red Laser'))
    const Icon = control.icon
    return Icon ? <Icon className={className} /> : null
  }

  test('paints itself paper when no class is given', () => {
    const { container } = render(<IconHarness />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('style')).toContain('color')
  })

  test("a caller's class takes the colour over entirely", () => {
    const { container } = render(<IconHarness className="ink" />)
    const svg = container.querySelector('svg')
    expect(svg?.classList.contains('ink')).toBe(true)
    expect(svg?.getAttribute('style')).toBeNull()
  })
})
