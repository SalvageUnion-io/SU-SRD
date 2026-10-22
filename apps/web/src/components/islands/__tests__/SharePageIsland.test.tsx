import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { pageOrigin } from '../../../lib/site'
import { SharePageIsland } from '../SharePageIsland'

const here = () => `${pageOrigin()}${location.pathname}`

async function press(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Share this page' }))
  })
}

describe('SharePageIsland', () => {
  test('copies the page’s own address where there is no share sheet, and says Copied', async () => {
    const writeClipboard = mock(async (_text: string) => {})
    render(<SharePageIsland deps={{ writeClipboard }} />)
    expect(screen.getByRole('status').textContent).toBe('')
    await press()
    expect(writeClipboard).toHaveBeenCalledWith(here())
    expect(screen.getByRole('status').textContent).toBe('Copied')
  })

  test('opens the share sheet with the page’s title and address where there is one', async () => {
    const share = mock(async (_data: ShareData) => {})
    const writeClipboard = mock(async (_text: string) => {})
    document.title = 'Mule // Salvage Union'
    render(<SharePageIsland deps={{ share, writeClipboard }} />)
    await press()
    expect(share).toHaveBeenCalledWith({ title: 'Mule // Salvage Union', url: here() })
    expect(writeClipboard).not.toHaveBeenCalled()
  })

  test('closing the sheet unshared is quiet', async () => {
    const share = mock(async (_data: ShareData) => {
      throw new DOMException('closed', 'AbortError')
    })
    render(<SharePageIsland deps={{ share, writeClipboard: async () => {} }} />)
    await press()
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByText(/could not be shared/)).toBeNull()
  })

  test('a copy that does not land is no Copied', async () => {
    const writeClipboard = mock(async (_text: string) => {
      throw new Error('denied')
    })
    render(<SharePageIsland deps={{ writeClipboard }} />)
    await press()
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
