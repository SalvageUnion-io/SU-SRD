import { describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { ToasterMount, toast } from '../Toaster'
import { holdToastsOnTop } from '../toastPlacement'

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
})
