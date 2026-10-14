/**
 * The phone bar's ≡ menu (ADR-045 D9): its list, a panel opened full-screen
 * with ‹ back, the Mediator's Downtime control, the way back to the Game, and
 * focus landing on the new view's heading — or the SRD panel's search box.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import type { PhoneMenuView, PhonePanel } from '../PhoneMenu'
import { PhoneMenu } from '../PhoneMenu'

const PANELS: Record<PhonePanel, React.ReactNode> = {
  log: <p>the game log</p>,
  crew: <p>the crew list</p>,
  reference: <p>the reference cards</p>,
  tables: <p>the roll tables</p>,
  srd: <input aria-label="Search the SRD" />,
}

type Events = string[]

function Harness({
  events,
  initial = 'menu',
  crewAttention = false,
  downtime = false,
  gameHref = '/games/g1',
}: {
  events: Events
  initial?: PhoneMenuView
  crewAttention?: boolean
  downtime?: boolean
  gameHref?: string | null
}) {
  const [open, setOpen] = useState(true)
  const [view, setView] = useState<PhoneMenuView>(initial)
  return (
    <PhoneMenu
      open={open}
      view={view}
      onView={(next) => {
        events.push(`view:${next}`)
        setView(next)
      }}
      onClose={() => {
        events.push('close')
        setOpen(false)
      }}
      game={<p>Latest alert: Spectrum overheating</p>}
      crewAttention={crewAttention}
      panels={PANELS}
      downtimeAction={
        downtime
          ? {
              label: 'Start Downtime',
              title: 'Begin the Downtime steps',
              onClick: () => events.push('downtime'),
            }
          : undefined
      }
      gameHref={gameHref}
    />
  )
}

async function renderMenu(props: Omit<Parameters<typeof Harness>[0], 'events'> = {}) {
  const events: Events = []
  await act(async () => {
    render(<Harness events={events} {...props} />)
  })
  return events
}

/** The view's own heading — the dialog's hidden title carries the same words. */
function viewHeading(name: string): HTMLElement {
  const heading = screen
    .getAllByRole('heading', { level: 2, name })
    .find((h) => h.getAttribute('tabindex') === '-1')
  if (!heading) throw new Error(`no ${name} heading`)
  return heading
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

describe('the menu', () => {
  test('lists the Game, every panel and the way back to the Game', async () => {
    await renderMenu()
    const nav = within(screen.getByRole('navigation', { name: 'Dashboard' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Menu' })).toBeTruthy()
    expect(nav.getByText('Latest alert: Spectrum overheating')).toBeTruthy()
    for (const name of ['Log', 'Crew', 'Reference', 'Tables', 'SRD']) {
      expect(nav.getByRole('button', { name })).toBeTruthy()
    }
    expect(nav.getByRole('link', { name: 'Return to Game' }).getAttribute('href')).toBe('/games/g1')
    // No ‹ on the menu itself.
    expect(screen.queryByRole('button', { name: 'Back to the menu' })).toBeNull()
  })

  test('with no known Game page, Return to Game goes home', async () => {
    await renderMenu({ gameHref: null })
    expect(screen.getByRole('link', { name: 'Return to Game' }).getAttribute('href')).toBe('/')
  })

  test('Crew carries a ▲ that is spelled out when someone needs attention', async () => {
    await renderMenu({ crewAttention: true })
    const crew = screen.getByRole('button', { name: /^Crew\s*, needs attention$/ })
    expect(crew.textContent).toContain('▲')
    expect(screen.getByRole('button', { name: 'Log' }).textContent).not.toContain('▲')
  })

  test('a player sees no Downtime control', async () => {
    await renderMenu()
    expect(screen.queryByRole('button', { name: 'Start Downtime' })).toBeNull()
  })

  test("the Mediator's Downtime control closes the menu, then runs", async () => {
    const events = await renderMenu({ downtime: true })
    const start = screen.getByRole('button', { name: 'Start Downtime' })
    expect(start.getAttribute('title')).toBe('Begin the Downtime steps')
    await click(start)
    expect(events).toEqual(['close', 'downtime'])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('the × closes the menu', async () => {
    const events = await renderMenu()
    await click(screen.getByRole('button', { name: 'Close the menu' }))
    expect(events).toEqual(['close'])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('Escape closes the menu', async () => {
    const events = await renderMenu()
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    })
    expect(events).toEqual(['close'])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('focus lands on the menu heading', async () => {
    await renderMenu()
    const heading = screen.getByRole('heading', { level: 2, name: 'Menu' })
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })
})

describe('a panel', () => {
  test('opens full-screen under its own title, and ‹ goes back to the menu', async () => {
    const events = await renderMenu()
    await click(screen.getByRole('button', { name: 'Tables' }))
    expect(screen.getByRole('dialog', { name: 'Tables' })).toBeTruthy()
    expect(viewHeading('Tables')).toBeTruthy()
    expect(screen.getByText('the roll tables')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Dashboard' })).toBeNull()

    await click(screen.getByRole('button', { name: 'Back to the menu' }))
    expect(events).toEqual(['view:tables', 'view:menu'])
    expect(screen.getByRole('dialog', { name: 'Dashboard menu' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Dashboard' })).toBeTruthy()
  })

  test('the new view takes focus at its heading', async () => {
    await renderMenu()
    await click(screen.getByRole('button', { name: 'Log' }))
    const heading = viewHeading('Log')
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })

  test('the SRD panel takes focus at its search box', async () => {
    await renderMenu({ initial: 'srd' })
    const search = screen.getByRole('textbox', { name: 'Search the SRD' })
    await waitFor(() => expect(document.activeElement).toBe(search))
  })
})
