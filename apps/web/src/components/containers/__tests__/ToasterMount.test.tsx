import { describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { ToasterMount, toast } from '../Toaster'

const regions = () => document.body.querySelectorAll('section[aria-label^="Notifications"]')

describe('ToasterMount (chrome K5, hard rule R20)', () => {
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
})
