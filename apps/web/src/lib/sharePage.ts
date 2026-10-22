/**
 * A reference page's SHARE (`SharePageButton`), live without React: the
 * client entry listens once for a press on any `[data-share-page]`, so a page
 * nobody touches loads nothing more, and the share sheet opens inside the
 * reader's own tap (a browser allows one only there).
 *
 * Under a coarse pointer with a share sheet it opens that sheet (a desktop's
 * is a detour from the clipboard, which is what a desktop reader reaches
 * for); anywhere else it copies the page's link. Copied is the control's own
 * Check swap (`data-copied`) and its polite status, never a toast (chrome
 * K5); with no React on the page, a copy that does not land says so in that
 * same status. Closing the sheet unshared is no failure.
 */

/** The attribute that marks the button; its status is the element right after it. */
export const SHARE_PAGE_ATTRIBUTE = 'data-share-page'

/** How long the Check shows, as `useCopied`'s. */
const COPIED_MS = 2000

export type SharePageDeps = {
  /** The device's share sheet, where it has one worth opening (a touch screen's). */
  share?: (data: ShareData) => Promise<void>
  writeClipboard: (text: string) => Promise<void>
}

function browserDeps(): SharePageDeps {
  const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false
  return {
    share:
      coarse && typeof navigator.share === 'function' ? (data) => navigator.share(data) : undefined,
    writeClipboard: (text) => navigator.clipboard.writeText(text),
  }
}

/**
 * The page's own address, on the origin it was served from (a Preview's opens
 * that Preview), without its hash or query. Read straight off `location`, not
 * through `site.ts`, whose import of the reference package would ship with
 * every page.
 */
export function sharePageUrl(location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}`
}

async function sharePage(button: HTMLElement, deps: SharePageDeps): Promise<void> {
  const doc = button.ownerDocument
  const status = button.nextElementSibling
  const url = sharePageUrl(doc.location)
  if (deps.share) {
    try {
      await deps.share({ title: doc.title, url })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (status) status.textContent = 'The page could not be shared. Try again.'
    }
    return
  }
  try {
    await deps.writeClipboard(url)
  } catch {
    if (status) status.textContent = 'The link could not be copied. Try again.'
    return
  }
  button.setAttribute('data-copied', '')
  if (status) status.textContent = 'Copied'
  setTimeout(() => {
    button.removeAttribute('data-copied')
    if (status) status.textContent = ''
  }, COPIED_MS)
}

/** Answers every SHARE on `doc`, now and later, with one listener. */
export function watchSharePage(doc: Document, deps: () => SharePageDeps = browserDeps): void {
  doc.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLElement>(`[${SHARE_PAGE_ATTRIBUTE}]`)
    if (button) void sharePage(button, deps())
  })
}
