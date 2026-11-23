import { describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { ToasterMount, toast } from '../Toaster'
import { holdPlayToasts, holdToastsOnTop } from '../toastPlacement'

const regions = () => document.body.querySelectorAll('section[aria-label^="Notifications"]')

describe('ToasterMount (chrome K5)', () => {
  test('three mounts on a page draw one toast region', () => {
    render(
      <>
        <ToasterMount />
        <ToasterMount />
      </>
    )
    render(<ToasterMount />)
    expect(regions()).toHaveLength(1)
  })

  test('when the one drawing it goes, the next takes it over', async () => {
    const first = render(<ToasterMount />)
    render(<ToasterMount />)
    first.unmount()
    expect(regions()).toHaveLength(1)
    await act(async () => {
      toast('Saved')
    })
    expect(await screen.findByText('Saved')).toBeTruthy()
  })

  test('a screen that holds the toasts moves them to the top, and lets go (r2 C4)', async () => {
    render(<ToasterMount />)
    await act(async () => {
      toast('Saved')
    })
    await screen.findByText('Saved')
    const list = () => document.body.querySelector('[data-sonner-toaster]')
    expect(list()?.getAttribute('data-y-position')).toBe('bottom')
    let release = () => {}
    await act(async () => {
      release = holdToastsOnTop()
    })
    await act(async () => {
      toast('Held')
    })
    await screen.findByText('Held')
    expect(list()?.getAttribute('data-y-position')).toBe('top')
    await act(async () => {
      release()
      // Letting go twice lets go once.
      release()
    })
    expect(list()?.getAttribute('data-y-position')).toBe('bottom')
  })

  test('a Play screen holds them bottom left, one at a time (r6 A3)', async () => {
    render(<ToasterMount />)
    let release = () => {}
    await act(async () => {
      release = holdPlayToasts()
    })
    await act(async () => {
      toast('First')
      toast('Second')
    })
    await screen.findByText('Second')
    const list = () => document.body.querySelector('[data-sonner-toaster]')
    expect(list()?.getAttribute('data-x-position')).toBe('left')
    // The newer replaces the older: one shows.
    const shown = [...document.body.querySelectorAll('[data-sonner-toast]')].filter(
      (each) => each.getAttribute('data-visible') === 'true'
    )
    expect(shown).toHaveLength(1)
    await act(async () => {
      release()
    })
    expect(list()?.getAttribute('data-x-position')).toBe('right')
  })

  test('everywhere a newer toast replaces the older (r7 A4)', async () => {
    render(<ToasterMount />)
    await act(async () => {
      toast('Removed Green Laser.', { action: { label: 'Undo', onClick: () => {} } })
      toast('Removed Hydraulic Crusher.', { action: { label: 'Undo', onClick: () => {} } })
    })
    await screen.findByText('Removed Hydraulic Crusher.')
    const open = toast.getToasts().filter((t) => !('dismiss' in t && t.dismiss))
    expect(open.map((t) => (t as { title?: unknown }).title)).toEqual([
      'Removed Hydraulic Crusher.',
    ])
  })

  test('over a dialog on a phone, toasts held at the top stand at the foot (r7 A4)', async () => {
    const realMatch = window.matchMedia
    window.matchMedia = ((query: string) => ({
      ...realMatch(query),
      matches: query === '(width < 600px)',
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia
    let release = () => {}
    try {
      render(<ToasterMount />)
      await act(async () => {
        release = holdToastsOnTop()
        toast('Built Longhaul Tank from the pattern.')
      })
      await screen.findByText('Built Longhaul Tank from the pattern.')
      const list = () => document.body.querySelector('[data-sonner-toaster]')
      expect(list()?.getAttribute('data-y-position')).toBe('top')
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      await act(async () => {
        document.body.append(dialog)
      })
      expect(list()?.getAttribute('data-y-position')).toBe('bottom')
      await act(async () => {
        dialog.remove()
        release()
      })
    } finally {
      window.matchMedia = realMatch
    }
  })
})
