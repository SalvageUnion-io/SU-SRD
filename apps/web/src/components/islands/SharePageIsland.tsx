import { Share2 } from 'lucide-react'
import { pageOrigin } from '../../lib/site'
import { Button, CopiedIcon, CopiedStatus, ToasterMount, toast, tokens, useCopied } from '../index'

/** How the page is handed on: the system share sheet where it is a phone's, else the clipboard. */
export type SharePageDeps = {
  /** The device's share sheet, where it has one worth opening (a touch screen's). */
  share?: (data: ShareData) => Promise<void>
  writeClipboard: (text: string) => Promise<void>
}

/**
 * A phone's share sheet is where a reader passes a page on; a desktop's
 * (Chrome and Safari have one) is a detour from the clipboard, which is what
 * a desktop reader reaches for. So the sheet only under a coarse pointer.
 */
function defaultDeps(): SharePageDeps {
  const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false
  return {
    share:
      coarse && typeof navigator.share === 'function' ? (data) => navigator.share(data) : undefined,
    writeClipboard: (text) => navigator.clipboard.writeText(text),
  }
}

/** The page's own address, on the origin it was served from (a Preview's link opens that Preview), without its hash or query. */
function pageUrl(): string {
  return `${pageOrigin()}${globalThis.location?.pathname ?? '/'}`
}

/**
 * SharePageIsland — a reference page's SHARE, beside Build With This on its
 * band (EDL E20): the share sheet on a phone, the page's link copied
 * anywhere else, Copied as the control's own Check swap and a polite status
 * (chrome K5). On a phone's band it is its glyph alone, so the stamps keep
 * their room beside the title. Closing the sheet unshared is no failure; a
 * copy that does not land toasts.
 *
 * Server-rendered and hydrated (`hydrate`): it reads no game data, and the
 * address it hands on is read at the press, so one island serves every page.
 */
export function SharePageIsland({ deps }: { deps?: SharePageDeps }) {
  const { copied, flash } = useCopied()

  async function share(): Promise<void> {
    const { share: openSheet, writeClipboard } = deps ?? defaultDeps()
    const url = pageUrl()
    if (openSheet) {
      try {
        await openSheet({ title: document.title, url })
      } catch (error) {
        // The reader closed the sheet: nothing to report.
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error('The page could not be shared. Try again.', { id: 'share-page' })
      }
      return
    }
    try {
      await writeClipboard(url)
      flash()
    } catch {
      toast.error('The link could not be copied. Try again.', { id: 'share-page' })
    }
  }

  return (
    <>
      <Button
        size="compact"
        aria-label="Share this page"
        className="su-page-action su-share-page su-hit-area"
        onClick={() => void share()}
      >
        <CopiedIcon
          copied={copied}
          size="compact"
          icon={<Share2 aria-hidden="true" size={tokens.iconSize.compact} />}
        />
        <span className="su-share-page__label">Share</span>
      </Button>
      <CopiedStatus copied={copied} />
      <ToasterMount />
    </>
  )
}
