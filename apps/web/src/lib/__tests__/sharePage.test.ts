import { describe, expect, mock, test } from 'bun:test'
import { referenceCopy } from '../../messages/reference'
import type { SharePageDeps } from '../sharePage'
import { SHARE_PAGE_ATTRIBUTE, sharePageUrl, watchSharePage } from '../sharePage'

/** A fresh document holding one SHARE and its status, as `SharePageButton` draws them. */
function page(deps: SharePageDeps) {
  const doc = document.implementation.createHTMLDocument()
  doc.title = 'Mule // Salvage Union'
  doc.body.innerHTML = `<button ${SHARE_PAGE_ATTRIBUTE} data-share-failed="${referenceCopy('shareFailed')}" data-copy-failed="${referenceCopy('copyLinkFailed')}"><span>Share</span></button><span role="status"></span>`
  watchSharePage(doc, () => deps)
  const button = doc.querySelector('button') as HTMLButtonElement
  const status = doc.querySelector('[role="status"]') as HTMLElement
  // Pressed on its label, as a reader does: the listener finds the button.
  const press = async () => {
    ;(button.querySelector('span') as HTMLElement).click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { doc, button, status, press }
}

describe('sharePageUrl', () => {
  test('is the page on its own origin, without hash or query', () => {
    expect(sharePageUrl({ origin: 'https://pr-1.example.dev', pathname: '/chassis/mule/' })).toBe(
      'https://pr-1.example.dev/chassis/mule/'
    )
  })
})

describe('watchSharePage', () => {
  test('copies the page’s address where there is no share sheet, and says Copied', async () => {
    const writeClipboard = mock(async (_text: string) => {})
    const { doc, button, status, press } = page({ writeClipboard })
    await press()
    expect(writeClipboard).toHaveBeenCalledWith(sharePageUrl(doc.location))
    expect(button.hasAttribute('data-copied')).toBe(true)
    expect(status.textContent).toBe('Copied')
  })

  test('opens the share sheet with the page’s title and address where there is one', async () => {
    const share = mock(async (_data: ShareData) => {})
    const writeClipboard = mock(async (_text: string) => {})
    const { doc, button, press } = page({ share, writeClipboard })
    await press()
    expect(share).toHaveBeenCalledWith({
      title: 'Mule // Salvage Union',
      url: sharePageUrl(doc.location),
    })
    expect(writeClipboard).not.toHaveBeenCalled()
    expect(button.hasAttribute('data-copied')).toBe(false)
  })

  test('closing the sheet unshared is quiet', async () => {
    const share = mock(async (_data: ShareData) => {
      throw new DOMException('closed', 'AbortError')
    })
    const { status, press } = page({ share, writeClipboard: async () => {} })
    await press()
    expect(status.textContent).toBe('')
  })

  test('a copy that does not land says so, and is no Copied', async () => {
    const { button, status, press } = page({
      writeClipboard: async () => {
        throw new Error('denied')
      },
    })
    await press()
    expect(button.hasAttribute('data-copied')).toBe(false)
    expect(status.textContent).toBe('The link could not be copied. Try again.')
  })
})
